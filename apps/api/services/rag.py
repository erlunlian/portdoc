"""RAG (Retrieval-Augmented Generation) service for chat"""

import re
import time
from collections.abc import AsyncGenerator
from uuid import UUID

import structlog
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import ChatRun, Chunk, Message, MessageRole
from services.embeddings import EmbeddingService
from services.prompts import (
    build_rag_system_prompt,
    build_rag_user_prompt_with_context,
    build_title_generation_messages,
)

logger = structlog.get_logger()


class RAGService:
    """Service for retrieval-augmented generation using Ollama"""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key="ollama",  # Ollama ignores the key but the SDK requires one
            base_url=settings.ollama_base_url,
        )
        self.model = settings.ollama_model
        logger.info("Using Ollama for chat", model=self.model, base_url=settings.ollama_base_url)

        self.embedding = EmbeddingService()

    def convert_math_to_latex(self, text: str) -> str:
        r"""
        Convert LaTeX math delimiters to markdown-compatible format.

        Converts:
        - \(...\) to $...$ (inline math)
        - \[...\] to $$...$$ (display math)
        - (V(\phi)=...) to $V(\phi)=...$ (parentheses-wrapped formulas with LaTeX)

        This handles formulas that contain:
        - Backslashes (LaTeX commands like \phi, \mu, etc.)
        - Curly braces for subscripts/superscripts {2}
        - Mathematical operators
        - Greek letters and special symbols
        """
        # First, convert standard LaTeX delimiters to markdown format
        # Convert display math \[...\] to $$...$$
        text = re.sub(r"\\" + r"\[(.*?)\\" + r"\]", r"$$\1$$", text, flags=re.DOTALL)

        # Convert inline math \(...\) to $...$
        text = re.sub(r"\\" + r"\((.*?)\\" + r"\)", r"$\1$", text, flags=re.DOTALL)

        # Also handle parentheses-wrapped formulas (for backward compatibility)
        # Skip this if we already have $ delimiters in the text (avoid double conversion)
        def find_and_replace_paren_math(text: str) -> str:
            result = []
            i = 0
            while i < len(text):
                # Skip sections that are already in $ delimiters
                if text[i] == "$":
                    # Find matching closing $
                    result.append(text[i])
                    i += 1
                    while i < len(text) and text[i] != "$":
                        result.append(text[i])
                        i += 1
                    if i < len(text):
                        result.append(text[i])  # closing $
                        i += 1
                    continue

                if text[i] == "(":
                    # Try to find matching closing paren
                    depth = 1
                    j = i + 1
                    while j < len(text) and depth > 0:
                        if text[j] == "(":
                            depth += 1
                        elif text[j] == ")":
                            depth -= 1
                        j += 1

                    if depth == 0:
                        # Found matching closing paren
                        content = text[i + 1 : j - 1]
                        # Check if it looks like math (contains LaTeX commands, super/subscripts, or braces)
                        if any(char in content for char in ["\\", "^", "_", "{", "}"]):
                            # Convert to LaTeX delimiters
                            result.append(f"${content}$")
                            i = j
                            continue
                result.append(text[i])
                i += 1
            return "".join(result)

        return find_and_replace_paren_math(text)

    async def validate_llm_connection(self) -> None:
        """
        Validate that we can connect to the LLM with the current configuration.
        Raises an exception if the connection or parameters are invalid.
        """
        try:
            # Test with a minimal request to validate parameters
            test_messages = [
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Hi"},
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
        page_filter: tuple[int, int] | None = None,
        db: AsyncSession = None,
    ) -> list[dict]:
        """
        Retrieve relevant chunks using semantic search.
        Returns list of dicts with: chunk_id, page, text, similarity.
        """
        try:
            # Generate query embedding (1024-dim Ollama embedding)
            query_embedding = await self.embedding.embed_text(query)

            query_stmt = (
                select(
                    Chunk.id,
                    Chunk.page,
                    Chunk.text,
                    Chunk.embedding.cosine_distance(query_embedding).label("distance"),
                )
                .where(Chunk.document_id == document_id, Chunk.embedding.isnot(None))
                .order_by("distance")
                .limit(k)
            )

            if page_filter:
                min_page, max_page = page_filter
                query_stmt = query_stmt.where(Chunk.page >= min_page, Chunk.page <= max_page)

            result = await db.execute(query_stmt)
            rows = result.all()

            chunks = [
                {
                    "chunk_id": str(row.id),
                    "page": row.page,
                    "text": self.convert_math_to_latex(row.text),  # Convert math formulas to LaTeX
                    "similarity": 1 - row.distance,
                }
                for row in rows
            ]

            logger.info(
                "Retrieved chunks for query",
                document_id=str(document_id),
                result_count=len(chunks),
            )
            return chunks

        except Exception as e:
            logger.error("Failed to retrieve chunks", error=str(e), exc_info=e)
            if db is not None:
                try:
                    await db.rollback()
                except Exception as rollback_error:
                    logger.warning(
                        "Rollback failed after chunk retrieval error",
                        rollback_error=str(rollback_error),
                        exc_info=rollback_error,
                    )
            return []

    def build_system_prompt(self, chunks: list[dict]) -> str:
        """Build system prompt with retrieved chunks"""
        system_prompt = build_rag_system_prompt(chunks)
        logger.info(
            "Built system prompt",
            num_chunks=len(chunks),
            prompt_length=len(system_prompt),
            has_content=bool(chunks),
        )
        return system_prompt

    async def generate_response(
        self,
        thread_id: UUID,
        user_message: str,
        chunks: list[dict],
        message_history: list[Message],
        db: AsyncSession,
    ) -> AsyncGenerator[str, None]:
        """
        Generate streaming response from LLM with RAG
        Yields tokens as they are generated
        Note: User message should already be saved in the database before calling this
        """
        start_time = time.time()

        try:
            # Build system prompt (instructions only, no context - that goes in user message)
            system_prompt = "You are a helpful AI assistant that answers questions about PDF documents. Always cite page numbers when referencing information from the document. Answer based ONLY on the provided context."

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

            # Add current user message WITH context (standard RAG approach)
            user_message_with_context = build_rag_user_prompt_with_context(user_message, chunks)
            messages.append({"role": "user", "content": user_message_with_context})

            # Log what we're sending to the LLM
            logger.info(
                "Sending messages to LLM",
                num_messages=len(messages),
                num_chunks=len(chunks),
                system_prompt_length=len(messages[0]["content"]) if messages else 0,
                user_message_with_context_length=len(user_message_with_context),
                original_user_message=user_message[:100],
            )

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
                        stream = await self.client.chat.completions.create(**base_params, **params)
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
                    exc_info=True,  # This will log the full stack trace
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
                    exc_info=True,
                )
                raise Exception(f"Streaming error: {str(e)}")

            # Calculate metrics
            latency_ms = (time.time() - start_time) * 1000
            tokens_prompt = sum(len(m["content"]) // 4 for m in messages)  # Rough estimate
            tokens_completion = len(full_response) // 4  # Rough estimate

            # Save assistant message with metadata (user message already saved)
            chunk_ids = [chunk["chunk_id"] for chunk in chunks]
            pages = sorted(set(chunk["page"] for chunk in chunks))

            # Convert math formulas in the response before saving
            converted_response = self.convert_math_to_latex(full_response)

            assistant_msg = Message(
                thread_id=thread_id,
                role=MessageRole.ASSISTANT,
                content=converted_response,
                tokens_completion=tokens_completion,
                message_metadata={"chunk_ids": chunk_ids, "pages": pages},
            )
            db.add(assistant_msg)

            # Log chat run for observability
            chat_run = ChatRun(
                thread_id=thread_id,
                provider="ollama",
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
            if db is not None:
                try:
                    await db.rollback()
                except Exception as rollback_error:
                    logger.warning(
                        "Rollback failed after generation error",
                        rollback_error=str(rollback_error),
                        exc_info=rollback_error,
                    )
            logger.error("Failed to generate response", error=str(e), exc_info=e)
            yield f"\n\n[Error: Failed to generate response - {str(e)}]"

    async def generate_thread_title(self, user_message: str) -> str:
        """Generate a concise title for a thread based on the first user message"""
        try:
            messages = build_title_generation_messages(user_message)

            # Try different parameter combinations
            response = None
            param_combinations = [
                {"max_completion_tokens": 20, "temperature": 0.7},
                {"max_completion_tokens": 20},
                {"max_tokens": 20, "temperature": 0.7},
                {"max_tokens": 20},
            ]

            for params in param_combinations:
                try:
                    response = await self.client.chat.completions.create(
                        model=self.model, messages=messages, **params
                    )
                    break
                except Exception as e:
                    logger.debug(f"Title generation attempt failed with params {params}: {str(e)}")
                    continue

            if response is None:
                logger.error("Failed to generate thread title")
                return "New Chat"

            title = response.choices[0].message.content.strip()
            # Ensure max 4 words and clean up
            words = title.split()[:4]
            title = " ".join(words)

            # Remove any quotes or extra punctuation
            title = title.strip("\"'.,!?")

            logger.info(f"Generated thread title: {title}")
            return title if title else "New Chat"

        except Exception as e:
            logger.error(f"Error generating thread title: {str(e)}")
            return "New Chat"

    def _estimate_cost(self, tokens_prompt: int, tokens_completion: int) -> float:
        """Ollama runs locally; report zero cost."""
        return 0.0
