#!/bin/sh
set -e

echo "Creating database tables..."
python -c "
import asyncio
from app.core.database import engine, Base
from app.models import *  # import all models

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created successfully')

asyncio.run(create_tables())
"

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
