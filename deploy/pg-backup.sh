#!/usr/bin/env bash
# Nightly PostgreSQL backup for Astolfo. Keeps 14 days of dumps.
# Install: sudo mkdir -p /opt/astolfo/bin
#          sudo cp deploy/pg-backup.sh /opt/astolfo/bin/ && sudo chmod +x /opt/astolfo/bin/pg-backup.sh
# Schedule as the postgres user (peer auth, no password needed):
#          sudo crontab -e -u postgres
#          15 3 * * * /opt/astolfo/bin/pg-backup.sh
# Docker deploy: set PG_DUMP, DB and DIR in the crontab line instead (see deploy/setup-server.md).
# Restore (with both services stopped):
#          pg_restore --clean --if-exists -d astolfo <file.dump>
set -euo pipefail

DIR=${DIR:-/var/backups/astolfo}
DB=${DB:-astolfo}
PG_DUMP=${PG_DUMP:-pg_dump}

mkdir -p "$DIR"
out="$DIR/astolfo_$(date +%F).dump"
# Write to stdout, not -f: with PG_DUMP="docker exec …" a -f path would be inside the container.
# The .tmp file and mv mean a failed dump never looks like a good one.
# shellcheck disable=SC2086 # PG_DUMP is a command with arguments, split on purpose
$PG_DUMP -Fc -d "$DB" > "$out.tmp"
mv "$out.tmp" "$out"
find "$DIR" -name '*.dump' -mtime +14 -delete
