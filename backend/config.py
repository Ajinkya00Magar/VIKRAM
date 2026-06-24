"""
PS13 — Configuration Module
All settings loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Application
    app_name: str = "PS13 Predictive Copilot"
    app_env: str = "development"
    log_level: str = "INFO"
    air_gapped: bool = True

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: List[str] = ["http://localhost:3000", "http://frontend:3000"]

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://ps13_user:ps13secret@postgres:5432/ps13_db"

    # InfluxDB
    influxdb_url: str = "http://influxdb:8086"
    influxdb_token: str = "ps13-influx-token-dev"
    influxdb_org: str = "ps13"
    influxdb_bucket: str = "network_telemetry"

    # ChromaDB
    chroma_host: str = "chromadb"
    chroma_port: int = 8000
    chroma_collection: str = "ps13_knowledge"

    # Ollama
    ollama_host: str = "http://ollama:11434"
    ollama_model: str = "mistral:7b-instruct"
    ollama_fallback_model: str = "phi3:mini"
    ollama_timeout: int = 120

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_device: str = "cpu"
    rag_top_k: int = 5
    rag_score_threshold: float = 0.65

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    # ML Parameters
    prophet_changepoint_prior: float = 0.05
    isolation_forest_contamination: float = 0.1
    xgboost_max_depth: int = 6
    xgboost_learning_rate: float = 0.1

    # Intervals (seconds)
    topology_refresh_interval: int = 30
    risk_calc_interval: int = 10
    prediction_interval: int = 60
    telemetry_poll_interval: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
