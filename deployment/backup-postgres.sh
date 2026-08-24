#!/bin/sh
set -eu
umask 077

ROOT_DIR=${ROOT_DIR:-"$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"}
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIR/docker-compose.production.yml"}
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_DIR=${BACKUP_DIR:?Set BACKUP_DIR to a host path that is synchronized off-server.}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

if [ ! -f "$ENV_FILE" ]; then
    echo "Production environment file not found: $ENV_FILE" >&2
    exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
archive="$BACKUP_DIR/masar-postgres-$timestamp.sql.gz"
checksum="$archive.sha256"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    | gzip -9 > "$archive"

sha256sum "$archive" > "$checksum"
find "$BACKUP_DIR" -type f -name 'masar-postgres-*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'masar-postgres-*.sql.gz.sha256' -mtime "+$BACKUP_RETENTION_DAYS" -delete

echo "Backup created: $archive"
