from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ERP System"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    DATABASE_URL: str = "postgresql+asyncpg://erp:erp@postgres:5432/erp"
    REDIS_URL: str = "redis://redis:6379"
    SUPER_ADMIN_SECRET: str = "super-admin-secret-2024"

    class Config:
        env_file = ".env"


settings = Settings()
