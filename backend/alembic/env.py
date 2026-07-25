import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.core.config import settings
from app.core.database import Base
import app.models.tenant  # noqa
import app.models.user    # noqa
import app.models.accounting  # noqa
import app.models.assets  # noqa
import app.models.notifications  # noqa
import app.models.sales  # noqa
import app.models.sales_orders  # noqa
import app.models.treasury  # noqa
import app.models.purchases  # noqa
import app.models.inventory  # noqa
import app.models.pos  # noqa
import app.models.ai  # noqa
import app.models.hr  # noqa
import app.models.ecommerce  # noqa
import app.models.system_config  # noqa
import app.models.notifications  # noqa

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=settings.DATABASE_URL, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        await conn.run_sync(
            lambda sync_conn: context.configure(connection=sync_conn, target_metadata=target_metadata)
        )
        async with conn.begin():
            await conn.run_sync(lambda _: context.run_migrations())
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
