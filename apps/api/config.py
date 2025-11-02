from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:54322/postgres"

    # Supabase
    supabase_url: str = "http://localhost:54321"
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    storage_bucket: str = "pdfs"

    # LLM Configuration
    llm_provider: str = "azure"  # "azure" or "openai"
    llm_api_key: str = ""

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"
    azure_openai_deployment_name: str = "gpt-4"

    # Standard OpenAI (fallback)
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4-turbo-preview"

    # Embeddings Configuration
    embedding_api_key: str = ""

    # Azure OpenAI Embeddings
    azure_embedding_endpoint: str = ""
    azure_embedding_api_version: str = "2024-02-15-preview"
    azure_embedding_deployment_name: str = "text-embedding-ada-002"

    # Standard OpenAI Embeddings (fallback)
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:54321"]


settings = Settings()
