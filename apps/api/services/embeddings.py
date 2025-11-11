"""Embedding generation service"""

import asyncio

import structlog
from openai import AsyncOpenAI

from config import settings

logger = structlog.get_logger()


class EmbeddingService:
    """Service for generating embeddings using Ollama"""

    def __init__(self):
        logger.info(
            "Using Ollama for embeddings",
            model=settings.ollama_embedding_model,
            base_url=settings.ollama_base_url,
        )
        self.client = AsyncOpenAI(
            api_key="ollama",  # Ollama ignores the API key, but the SDK requires one
            base_url=settings.ollama_base_url,
        )
        self.model = settings.ollama_embedding_model

    async def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text"""
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=text,
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error("Failed to generate embedding", error=str(e))
            raise

    async def embed_batch(self, texts: list[str], batch_size: int = 100) -> list[list[float]]:
        """Generate embeddings for multiple texts in batches"""
        embeddings = []

        # Process in batches to avoid rate limits
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                response = await self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                )
                batch_embeddings = [item.embedding for item in response.data]
                embeddings.extend(batch_embeddings)

                # Small delay between batches
                if i + batch_size < len(texts):
                    await asyncio.sleep(0.1)

            except Exception as e:
                logger.error(
                    "Failed to generate batch embeddings",
                    error=str(e),
                    error_type=type(e).__name__,
                    batch_index=i,
                    batch_size=len(batch),
                    endpoint=settings.ollama_base_url,
                    exc_info=e,
                )
                raise

        return embeddings
