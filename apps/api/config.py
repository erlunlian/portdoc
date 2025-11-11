from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the root directory (2 levels up from this file)
ROOT_DIR = Path(__file__).parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        case_sensitive=False,
        extra="ignore",  # Ignore extra fields from .env that are only used by Docker Compose
    )

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # Storage
    storage_path: str = "/tmp/storage/pdfs"

    # Ollama (local)
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "gpt-oss:20b"

    # Embeddings Configuration
    ollama_embedding_model: str = "mxbai-embed-large"
    embedding_dimension: int = 1024

    @model_validator(mode="after")
    def set_embedding_dimension(self):
        """Ensure embedding dimension matches the configured Ollama embedding model."""
        self.embedding_dimension = 1024
        return self

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
