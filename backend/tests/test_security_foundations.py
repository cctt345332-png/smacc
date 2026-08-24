import pytest
from pydantic import ValidationError

from app.core.config import Settings


SAFE_PRODUCTION = {
    "APP_ENV": "production",
    "SECRET_KEY": "a" * 48,
    "SUPER_ADMIN_SECRET": "b" * 40,
    "DATABASE_URL": "postgresql+asyncpg://release_user:strong-db-password@db.internal:5432/smacc",
    "REDIS_URL": "redis://redis.internal:6379/0",
    "CORS_ORIGINS": "https://erp.example.sa",
    "ENABLE_SUPER_ADMIN_BOOTSTRAP": False,
}


def test_development_defaults_remain_usable_for_local_bootstrap():
    settings = Settings(_env_file=None, APP_ENV="development")
    assert settings.APP_ENV == "development"


def test_production_rejects_default_secret_key():
    values = {**SAFE_PRODUCTION, "SECRET_KEY": "change-me-in-production"}
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, **values)


def test_production_rejects_default_database_url():
    values = {**SAFE_PRODUCTION, "DATABASE_URL": "postgresql+asyncpg://erp:erp@postgres:5432/erp"}
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None, **values)


def test_production_requires_cors_origins():
    values = {**SAFE_PRODUCTION, "CORS_ORIGINS": ""}
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(_env_file=None, **values)


def test_production_rejects_enabled_super_admin_bootstrap():
    values = {**SAFE_PRODUCTION, "ENABLE_SUPER_ADMIN_BOOTSTRAP": True}
    with pytest.raises(ValidationError, match="ENABLE_SUPER_ADMIN_BOOTSTRAP"):
        Settings(_env_file=None, **values)


def test_production_accepts_complete_configuration():
    settings = Settings(_env_file=None, **SAFE_PRODUCTION)
    assert settings.APP_ENV == "production"


def test_production_alias_is_normalized():
    settings = Settings(_env_file=None, **{**SAFE_PRODUCTION, "APP_ENV": "PROD"})
    assert settings.APP_ENV == "production"
