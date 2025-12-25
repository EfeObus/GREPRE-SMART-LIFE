"""
GrePre Smart Life - Configuration Settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_name: str = "GrePre Smart Life"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "your-super-secret-key-change-in-production"
    web_port: int = 5041

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/grepre_smartlife"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "grepre_smartlife"
    db_user: str = "postgres"
    db_password: str = ""

    # JWT
    jwt_secret: str = "your-jwt-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # File Upload
    upload_dir: str = "uploads"
    max_file_size: int = 10485760  # 10MB

    # OCR
    ocr_enabled: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
