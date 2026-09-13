#!/usr/bin/env bash
# Update Astolfo to the latest main (or a specific git SHA) and restart.
# Run as the `deploy` user:  /opt/astolfo/app/deploy/deploy.sh [<git-sha>]
#
# This is what the GitHub Actions self-hosted runner calls on every push to
# main. It is deliberately small: fetch, install, generate, db push, build,
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
# db push step sees DATABASE_URL and the web build sees BACKEND_URL.
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
# This repo syncs the schema with db push (stale migrations/ dir). No
# --accept-data-loss: a destructive change aborts the deploy instead of
# dropping data.
yarn prisma db push --schema "$SCHEMA"

# Build sequentially (not run-many) to keep peak memory down — the Angular SSR
# build alone can approach 2 GB. BACKEND_URL is baked into the web bundle here.
yarn nx build bot --configuration production
yarn nx build web --configuration production

sudo systemctl restart astolfo-bot astolfo-web

echo "Deployed $(git rev-parse --short HEAD). Health:"
curl -fsS http://localhost:3000/api/health && echo
