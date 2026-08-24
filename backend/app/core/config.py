from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


INSECURE_SECRETS = {
    "change-me-in-production",
    "super-secret-change-in-production",
    "super-admin-secret-2024",
    "preview-smacc-session-secret-2026-change-before-production",
}


class Settings(BaseSettings):
    """Application configuration with explicit production safety checks."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "ERP System"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    DATABASE_URL: str = "postgresql+asyncpg://erp:erp@postgres:5432/erp"
    REDIS_URL: str = "redis://redis:6379"
    SUPER_ADMIN_SECRET: str = "super-admin-secret-2024"
    ENABLE_SUPER_ADMIN_BOOTSTRAP: bool = False
    CORS_ORIGINS: str = ""

    @model_validator(mode="after")
    def validate_production_settings(self):
        aliases = {"dev": "development", "prod": "production"}
        self.APP_ENV = aliases.get(self.APP_ENV.strip().lower(), self.APP_ENV.strip().lower())
        if self.APP_ENV not in {"development", "preview", "staging", "production"}:
            raise ValueError("APP_ENV must be development, preview, staging, or production")
        if self.APP_ENV not in {"staging", "production"}:
            return self

        unsafe = []
        if self.SECRET_KEY in INSECURE_SECRETS or len(self.SECRET_KEY) < 32:
            unsafe.append("SECRET_KEY")
        if self.SUPER_ADMIN_SECRET in INSECURE_SECRETS or len(self.SUPER_ADMIN_SECRET) < 24:
            unsafe.append("SUPER_ADMIN_SECRET")
        if "erp:erp@postgres" in self.DATABASE_URL or "localhost" in self.DATABASE_URL:
            unsafe.append("DATABASE_URL")
        if not self.CORS_ORIGINS.strip():
            unsafe.append("CORS_ORIGINS")
        if self.ENABLE_SUPER_ADMIN_BOOTSTRAP:
            unsafe.append("ENABLE_SUPER_ADMIN_BOOTSTRAP")

        if unsafe:
            raise ValueError(
                "Unsafe production configuration: " + ", ".join(unsafe)
            )
        return self


settings = Settings()
