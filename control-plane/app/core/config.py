from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    SECRET_KEY: str = "dev-secret-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "https://flakeshield.vercel.app",
        "https://flakeshield-production.up.railway.app",
    ]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://flakeshield:changeme@localhost:5432/flakeshield"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Go Analyzer gRPC
    ANALYZER_GRPC_HOST: str = "localhost"
    ANALYZER_GRPC_PORT: int = 50051
    ANALYZER_HTTP_URL: str = "http://localhost:8001"

    # GitHub App
    GITHUB_APP_ID: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""

    # AI / Patch generation
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-3-5-sonnet-20241022"
    AI_PATCH_ENABLED: bool = False
    AI_PATCH_MOCK: bool = True

    # Embeddings
    EMBEDDINGS_ENABLED: bool = False

    # Observability
    LOG_LEVEL: str = "info"
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"


settings = Settings()
