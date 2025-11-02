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
        """
        start_time = time.time()

        try:
            # Build system prompt with retrieved chunks
            system_prompt = self.build_system_prompt(chunks)

            # Build messages for API
            messages = [{"role": "system", "content": system_prompt}]

            # Add recent message history (last 10 messages)
            for msg in message_history[-10:]:
                messages.append(
                    {
                        "role": msg.role.value.lower(),
                        "content": msg.content,
                    }
                )

            # Add current user message
            messages.append({"role": "user", "content": user_message})

            # Call LLM API with streaming
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                temperature=0.7,
                max_tokens=1500,
            )

            # Stream tokens
            full_response = ""
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield token

            # Calculate metrics
            latency_ms = (time.time() - start_time) * 1000
            tokens_prompt = sum(len(m["content"]) // 4 for m in messages)  # Rough estimate
            tokens_completion = len(full_response) // 4  # Rough estimate

            # Save user message
            user_msg = Message(
                thread_id=thread_id,
                role=MessageRole.USER,
                content=user_message,
                tokens_prompt=tokens_prompt,
            )
            db.add(user_msg)

            # Save assistant message with metadata
            chunk_ids = [chunk["chunk_id"] for chunk in chunks]
            pages = sorted(set(chunk["page"] for chunk in chunks))

            assistant_msg = Message(
                thread_id=thread_id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                tokens_completion=tokens_completion,
                metadata={"chunk_ids": chunk_ids, "pages": pages},
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
