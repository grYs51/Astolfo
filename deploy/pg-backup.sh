#!/usr/bin/env bash
# Nightly PostgreSQL backup for Astolfo. Keeps 14 days of dumps.
# Install: sudo mkdir -p /opt/astolfo/bin
#          sudo cp deploy/pg-backup.sh /opt/astolfo/bin/ && sudo chmod +x /opt/astolfo/bin/pg-backup.sh
# Schedule as the postgres user (peer auth, no password needed):
#          sudo crontab -e -u postgres
#          15 3 * * * /opt/astolfo/bin/pg-backup.sh
# Restore (with both services stopped):
#          pg_restore --clean --if-exists -d astolfo <file.dump>
set -euo pipefail

DIR=/var/backups/astolfo
mkdir -p "$DIR"
pg_dump -Fc -d astolfo -f "$DIR/astolfo_$(date +%F).dump"
find "$DIR" -name '*.dump' -mtime +14 -delete
