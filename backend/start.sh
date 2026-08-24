#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "Applying Alembic migrations..."
    python -m alembic upgrade head
fi

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
