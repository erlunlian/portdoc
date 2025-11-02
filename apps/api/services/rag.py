"""RAG (Retrieval-Augmented Generation) service for chat"""

import time
from typing import AsyncGenerator, List, Optional, Tuple
from uuid import UUID

import structlog
from openai import AsyncAzureOpenAI, AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ChatRun, Chunk, Message, MessageRole, Thread
from services.embeddings import EmbeddingService

logger = structlog.get_logger()


class RAGService:
    """Service for retrieval-augmented generation"""

    def __init__(self):
        # Initialize client based on provider
        if settings.llm_provider == "azure":
            self.client = AsyncAzureOpenAI(
                api_key=settings.llm_api_key,
                azure_endpoint=settings.azure_openai_endpoint,
                api_version=settings.azure_openai_api_version,
            )
            self.model = settings.azure_openai_deployment_name
            logger.info("Using Azure OpenAI for chat", deployment=self.model)
        else:
            self.client = AsyncOpenAI(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
            )
            self.model = settings.llm_model
            logger.info("Using OpenAI for chat", model=self.model)

        self.embedding = EmbeddingService()
    
    async def validate_llm_connection(self) -> None:
        """
        Validate that we can connect to the LLM with the current configuration.
        Raises an exception if the connection or parameters are invalid.
        """
        try:
            # Test with a minimal request to validate parameters
            test_messages = [
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Hi"}
            ]
            
            # Try the same parameter combinations we use in actual requests
            base_params = {
                "model": self.model,
                "messages": test_messages,
                "stream": False,
                "max_tokens": 10,  # Minimal tokens for testing
            }
            
            # Try different parameter combinations
            param_combinations = [
                {"max_completion_tokens": 10, "temperature": 0.7},
                {"max_completion_tokens": 10},
                {"max_tokens": 10, "temperature": 0.7},
                {"max_tokens": 10},
            ]
            
            success = False
            last_error = None
            
            for params in param_combinations:
                try:
                    # Remove duplicate max_tokens if max_completion_tokens is present
                    test_params = {**base_params}
                    if "max_completion_tokens" in params:
                        test_params.pop("max_tokens", None)
                    test_params.update(params)
                    
                    await self.client.chat.completions.create(**test_params)
                    success = True
                    logger.info(f"LLM validation successful with params: {params}")
                    break
                except Exception as e:
                    last_error = e
                    continue
            
            if not success:
                raise Exception(f"LLM configuration invalid: {str(last_error)}")
                
        except Exception as e:
            logger.error(f"LLM validation failed: {str(e)}")
            raise

    async def retrieve_chunks(
        self,
        document_id: UUID,
        query: str,
        k: int = 8,
        page_filter: Optional[Tuple[int, int]] = None,
        db: AsyncSession = None,
    ) -> List[dict]:
        """
        Retrieve relevant chunks using semantic search
        Returns list of dicts with: chunk_id, page, text, similarity
        """
        try:
            # Generate query embedding
            query_embedding = await self.embedding.embed_text(query)

            # Build query
            query_stmt = select(
                Chunk.id,
                Chunk.page,
                Chunk.text,
                Chunk.embedding.cosine_distance(query_embedding).label("distance"),
            ).where(Chunk.document_id == document_id)

            # Apply page filter if provided (page +/- range)
            if page_filter:
                min_page, max_page = page_filter
                query_stmt = query_stmt.where(Chunk.page >= min_page, Chunk.page <= max_page)

            # Order by similarity and limit
            query_stmt = query_stmt.order_by("distance").limit(k)

            result = await db.execute(query_stmt)
            rows = result.all()

            chunks = []
            for row in rows:
                chunks.append(
                    {
                        "chunk_id": str(row.id),
                        "page": row.page,
                        "text": row.text,
                        "similarity": 1 - row.distance,  # Convert distance to similarity
                    }
                )

            logger.info(f"Retrieved {len(chunks)} chunks for query", document_id=str(document_id))
            return chunks

        except Exception as e:
            logger.error("Failed to retrieve chunks", error=str(e))
            return []

    def build_system_prompt(self, chunks: List[dict]) -> str:
        """Build system prompt with retrieved chunks"""
        context = "\n\n".join([f"[Page {chunk['page']}]\n{chunk['text']}" for chunk in chunks])

        system_prompt = f"""You are a helpful AI assistant that answers questions about a PDF document.

Your task is to answer questions based ONLY on the provided context from the document.

Context from the document:
{context}

Guidelines:
- Always cite the page number when referencing information (e.g., "According to page 5...")
- If the answer is not in the provided context, clearly state "I don't have enough information in the document to answer that question."
- Be concise and accurate
- If multiple pages contain relevant information, cite all of them
- Do not make up information or use external knowledge"""

        return system_prompt

    async def generate_response(
        self,
        thread_id: UUID,
        user_message: str,
        chunks: List[dict],
        message_history: List[Message],
        db: AsyncSession,
    ) -> AsyncGenerator[str, None]:
        """
        Generate streaming response from LLM with RAG
        Yields tokens as they are generated
        Note: User message should already be saved in the database before calling this
        """
        start_time = time.time()

        try:
            # Build system prompt with retrieved chunks
            system_prompt = self.build_system_prompt(chunks)

            # Build messages for API
            messages = [{"role": "system", "content": system_prompt}]

            # Add recent message history (excluding the last message which is the current user message we just saved)
            # We want the last 10 messages before the current one
            if len(message_history) > 0:
                # The last message in history is the user message we just saved, so exclude it
                history_to_include = message_history[:-1] if message_history else []
                # Take the last 10 messages from the remaining history
                for msg in history_to_include[-10:]:
                    messages.append(
                        {
                            "role": msg.role.value.lower(),
                            "content": msg.content,
                        }
                    )

            # Add current user message
            messages.append({"role": "user", "content": user_message})

            # Call LLM API with streaming
            try:
                # Build base parameters
                base_params = {
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                }
                
                # Try different parameter combinations based on model capabilities
                stream = None
                last_error = None
                
                # Try combinations: (max_completion_tokens + temperature), (max_completion_tokens + no temp),
                # (max_tokens + temperature), (max_tokens + no temp)
                param_combinations = [
                    {"max_completion_tokens": 1500, "temperature": 0.7},
                    {"max_completion_tokens": 1500},  # Default temperature
                    {"max_tokens": 1500, "temperature": 0.7},
                    {"max_tokens": 1500},  # Default temperature
                ]
                
                for params in param_combinations:
                    try:
                        stream = await self.client.chat.completions.create(
                            **base_params,
                            **params
                        )
                        logger.info(f"LLM API call successful with params: {params}")
                        break  # Success, exit loop
                    except Exception as e:
                        last_error = e
                        error_str = str(e)
                        logger.debug(f"LLM API attempt failed with params {params}: {error_str}")
                        continue
                
                if stream is None:
                    # All attempts failed
                    error_msg = f"All LLM API attempts failed. Last error: {last_error}"
                    logger.error(error_msg, thread_id=str(thread_id), model=self.model)
                    raise Exception(error_msg)
                    
            except Exception as e:
                # Log the error with full context
                logger.error(
                    "Failed to create LLM stream",
                    error=str(e),
                    thread_id=str(thread_id),
                    model=self.model,
                    message_count=len(messages),
                    exc_info=True  # This will log the full stack trace
                )
                # Re-raise with a clean error message
                raise Exception(f"LLM API error: {str(e)}")

            # Stream tokens
            full_response = ""
            try:
                async for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0 and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        yield token
            except Exception as e:
                logger.error(
                    "Error during streaming",
                    error=str(e),
                    thread_id=str(thread_id),
                    response_length=len(full_response),
                    exc_info=True
                )
                raise Exception(f"Streaming error: {str(e)}")

            # Calculate metrics
            latency_ms = (time.time() - start_time) * 1000
            tokens_prompt = sum(len(m["content"]) // 4 for m in messages)  # Rough estimate
            tokens_completion = len(full_response) // 4  # Rough estimate

            # Save assistant message with metadata (user message already saved)
            chunk_ids = [chunk["chunk_id"] for chunk in chunks]
            pages = sorted(set(chunk["page"] for chunk in chunks))

            assistant_msg = Message(
                thread_id=thread_id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                tokens_completion=tokens_completion,
                message_metadata={"chunk_ids": chunk_ids, "pages": pages},
            )
            db.add(assistant_msg)

            # Log chat run for observability
            chat_run = ChatRun(
                thread_id=thread_id,
                provider="openai",
                model=self.model,
                latency_ms=latency_ms,
                cost_usd=self._estimate_cost(tokens_prompt, tokens_completion),
            )
            db.add(chat_run)

            await db.commit()

            logger.info(
                "Generated response",
                thread_id=str(thread_id),
                latency_ms=latency_ms,
                tokens_prompt=tokens_prompt,
                tokens_completion=tokens_completion,
            )

        except Exception as e:
            logger.error("Failed to generate response", error=str(e), exc_info=e)
            yield f"\n\n[Error: Failed to generate response - {str(e)}]"

    def _estimate_cost(self, tokens_prompt: int, tokens_completion: int) -> float:
        """Estimate cost in USD (rough estimates for GPT-4)"""
        # These are example rates - adjust based on actual model pricing
        cost_per_1k_prompt = 0.01  # $0.01 per 1K prompt tokens
        cost_per_1k_completion = 0.03  # $0.03 per 1K completion tokens

        cost = (tokens_prompt / 1000 * cost_per_1k_prompt) + (
            tokens_completion / 1000 * cost_per_1k_completion
        )
        return round(cost, 6)
