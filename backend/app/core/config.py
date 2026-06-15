"""
Configuración central de Glifo.
Lee variables desde .env (o entorno del sistema).
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


class Settings(BaseSettings):
    # ── Base de datos
    database_url: str = "postgresql+asyncpg://glifo:glifo@localhost:5432/glifo"
    database_sync_url: str = "postgresql+psycopg2://glifo:glifo@localhost:5432/glifo"

    # ── Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "llama3.2"
    ollama_vision_model: str = "llava"
    ollama_embed_model: str = "nomic-embed-text"

    # ── Archivos
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 2048

    # ── API
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = '["http://localhost:5173","http://localhost:3000"]'
    secret_key: str = "glifo-dev-secret"

    # ── Workers
    worker_concurrency: int = 2
    embedding_dim: int = 768

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return [self.cors_origins]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
