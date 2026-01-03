"""
Configuration module using Pydantic BaseSettings.
Loads configuration from environment variables with validation.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"
    
    # Security
    SECRET_KEY: str  # Required - no default for security
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Timezone
    TIMEZONE: str = "America/Lima"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # API
    API_TITLE: str = "GyH API"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "API para gestión de ingresos, ventas y stock de productos agrícolas"
    
    # Environment
    DEBUG: bool = False


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to avoid reading .env file on every call.
    """
    return Settings()


# Export settings instance for convenience
settings = get_settings()
