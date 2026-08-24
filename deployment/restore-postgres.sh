#!/bin/sh
set -eu

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
    echo "Refusing restore. Re-run with CONFIRM_RESTORE=YES after testing the backup on staging." >&2
    exit 1
fi

ROOT_DIR=${ROOT_DIR:-"$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"}
COMPOSE_FILE=${COMPOSE_FILE:-"$ROOT_DIR/docker-compose.production.yml"}
ENV_FILE=${ENV_FILE:-"$ROOT_DIR/.env.production"}
BACKUP_FILE=${1:?Usage: CONFIRM_RESTORE=YES $0 /absolute/path/to/backup.sql.gz}
CHECKSUM_FILE="$BACKUP_FILE.sha256"

if [ ! -f "$ENV_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Missing production environment file or backup archive." >&2
    exit 1
fi

if [ ! -f "$CHECKSUM_FILE" ]; then
    echo "Checksum file is required: $CHECKSUM_FILE" >&2
    exit 1
fi

sha256sum -c "$CHECKSUM_FILE"

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

gzip -cd "$BACKUP_FILE" | docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restore completed. Run application smoke tests before reopening access."
