"""Embedding generation service"""

import asyncio

import structlog
from openai import AsyncAzureOpenAI, AsyncOpenAI

from config import settings

logger = structlog.get_logger()


class EmbeddingService:
    """Service for generating embeddings"""

    def __init__(self):
        # Initialize client based on provider
        if settings.llm_provider == "azure":
            if not settings.azure_embedding_endpoint:
                raise ValueError(
                    "azure_embedding_endpoint is not set. Please set AZURE_EMBEDDING_ENDPOINT in your .env file"
                )
            if not settings.embedding_api_key:
                raise ValueError(
                    "embedding_api_key is not set. Please set EMBEDDING_API_KEY in your .env file"
                )
            logger.info(
                "Using Azure OpenAI for embeddings",
                deployment=settings.azure_embedding_deployment_name,
                endpoint=settings.azure_embedding_endpoint,
            )
            self.client = AsyncAzureOpenAI(
                api_key=settings.embedding_api_key,
                azure_endpoint=settings.azure_embedding_endpoint,
                api_version=settings.azure_embedding_api_version,
            )
            self.model = settings.azure_embedding_deployment_name
        else:
            if not settings.embedding_base_url:
                raise ValueError(
                    "embedding_base_url is not set. Please set EMBEDDING_BASE_URL in your .env file"
                )
            if not settings.embedding_api_key:
                raise ValueError(
                    "embedding_api_key is not set. Please set EMBEDDING_API_KEY in your .env file"
                )
            logger.info(
                "Using OpenAI for embeddings",
                model=settings.embedding_model,
                base_url=settings.embedding_base_url,
            )
            self.client = AsyncOpenAI(
                api_key=settings.embedding_api_key,
                base_url=settings.embedding_base_url,
            )
            self.model = settings.embedding_model

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
                    endpoint=getattr(settings, "azure_embedding_endpoint", None)
                    or getattr(settings, "embedding_base_url", None),
                    exc_info=e,
                )
                raise

        return embeddings
