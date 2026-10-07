#!/usr/bin/env bash
# Update Astolfo to the latest main (or a specific git SHA) and restart.
# Run as the `deploy` user:  /opt/astolfo/app/deploy/deploy.sh [<git-sha>]
#
# This is what the GitHub Actions self-hosted runner calls on every push to
# main. It is deliberately small: fetch, install, generate, migrate, build,
# restart. The two systemctl restarts are the only things that need sudo, and
# the sudoers rule installed by server-setup.sh permits exactly those.
set -euo pipefail

APP_DIR=/opt/astolfo/app
SCHEMA=libs/models/prisma/schema.prisma
SHA="${1:-}"

cd "$APP_DIR"

git fetch --all --prune
if [[ -n "$SHA" ]]; then
  git checkout --force "$SHA"
else
  git checkout main
  git reset --hard origin/main
fi

# .env is gitignored, so the reset above never touches it. Load it so the
# migrate step sees DATABASE_URL.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

corepack enable >/dev/null 2>&1 || true
yarn install --immutable

# `yarn prisma`, not `npx prisma`: npx ignores the workspace and downloads
# whatever is newest on the registry (it pulled the 8.0.0 RC against our 6.x
# client), while yarn resolves the pinned devDependency.
yarn prisma generate --schema "$SCHEMA"
# Apply pending migrations from libs/models/prisma/migrations — the same
# command the Docker image runs at startup, so both paths share one history.
yarn prisma migrate deploy --schema "$SCHEMA"

# Build sequentially (not run-many) to keep peak memory down — the Angular SSR
# build alone can approach 2 GB.
yarn nx build bot --configuration production
yarn nx build web --configuration production

sudo systemctl restart astolfo-bot astolfo-web

# The bot connects to the DB and registers handlers before it listens, so
# poll instead of failing a healthy deploy on the first connection refused
for _ in $(seq 1 20); do
  sleep 2
  if curl -fs http://localhost:3000/api/health; then
    echo
    echo "Deployed $(git rev-parse --short HEAD)."
    exit 0
  fi
done
echo "Health check FAILED after deploying $(git rev-parse --short HEAD) — inspect with: journalctl -u astolfo-bot -n 50" >&2
exit 1
