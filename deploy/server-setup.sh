#!/usr/bin/env bash
# One-shot production setup for Astolfo inside a fresh Debian 12 LXC.
# Run as root:  bash /root/server-setup.sh
#
# Idempotent: every stage checks whether it's already done, so re-running
# after a failure only does the missing parts.
#
# It asks all questions up front (domain + Discord app credentials), then the
# only pause is adding the deploy key to GitHub. TLS is NOT handled here —
# Nginx Proxy Manager terminates HTTPS and forwards plain HTTP to :80.
#
# Astolfo is TWO Node services behind Caddy:
#   bot  (:3000) — discord.js gateway client + Express API   -> /api/*
#   web  (:4000) — Angular SSR server (dashboard)            -> /*
set -euo pipefail

### Config ###################################################################
APP_NAME=astolfo
REPO_SSH=git@github.com:grYs51/Astolfo.git
APP_BASE=/opt/astolfo                  # owned by deploy; app clone + bin live here
APP_DIR=$APP_BASE/app
NODE_MAJOR=22                          # LTS; satisfies Angular 21 (^20.19 || ^22.12 || >=24)
PG_VERSION=17                          # parity with dev (postgres:17 in Docker)
DB_NAME=astolfo
DB_ROLE=astolfo
SCHEMA=libs/models/prisma/schema.prisma
BOT_SERVICE=astolfo-bot
WEB_SERVICE=astolfo-web
HEALTH_URL=http://localhost:3000/api/health
##############################################################################

log() { echo -e "\n\033[1m==> $*\033[0m"; }
as_deploy() { runuser -u deploy -- bash -lc "cd ~ && $*"; }
ENV_FILE=$APP_DIR/.env

[[ $EUID -eq 0 ]] || { echo "Run as root." >&2; exit 1; }

# ── All questions up front ──────────────────────────────────────────────────
if [[ -f $ENV_FILE ]]; then
  DOMAIN="$(grep -oP 'CLIENT_URL=https://\K[^/]*' "$ENV_FILE" || true)"
fi
while [[ -z "${DOMAIN:-}" ]]; do
  read -rp "Public domain the dashboard will live at (e.g. astolfo.grys.dev): " DOMAIN
done
BOT_TOKEN="" CLIENT_ID="" CLIENT_SECRET="" OWNER_ID="" PUBLIC_KEY=""
if [[ ! -f $ENV_FILE ]]; then
  echo
  echo "Discord application credentials (Developer Portal -> your app):"
  read -rp "  DISCORD_BOT_TOKEN: " BOT_TOKEN
  read -rp "  DISCORD_CLIENT_ID: " CLIENT_ID
  read -rp "  DISCORD_CLIENT_SECRET: " CLIENT_SECRET
  read -rp "  DISCORD_PUBLIC_KEY (Enter to skip): " PUBLIC_KEY
  read -rp "  OWNER (your Discord user ID): " OWNER_ID
fi

log "Base packages"
apt-get update
apt-get install -y curl git sudo ca-certificates gnupg openssl \
  debian-keyring debian-archive-keyring apt-transport-https

log "User 'deploy' and $APP_BASE"
id deploy &>/dev/null || adduser --disabled-password --gecos "" deploy
install -d -o deploy -g deploy "$APP_BASE"

log "Node $NODE_MAJOR + corepack (yarn 4)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v${NODE_MAJOR}.* ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
# corepack ships with Node; enabling it (as root) puts the `yarn` shim on PATH
# for every user, pinned to the version in package.json (yarn@4.12.0).
corepack enable
node -v

log "PostgreSQL $PG_VERSION (PGDG repo — Debian 12 itself only ships 15)"
# Guard on the versioned package, NOT `command -v psql`: postgresql-common
# ships a /usr/bin/psql wrapper even with no server installed, so checking for
# psql would wrongly skip this whole block.
if ! dpkg -s "postgresql-$PG_VERSION" >/dev/null 2>&1; then
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update
  apt-get install -y "postgresql-$PG_VERSION"
fi

log "Deploy key + clone"
KEY=/home/deploy/.ssh/id_ed25519
if [[ ! -f $KEY ]]; then
  as_deploy "mkdir -p ~/.ssh && chmod 700 ~/.ssh && ssh-keygen -q -t ed25519 -N '' -f ~/.ssh/id_ed25519 -C 'deploy@$APP_NAME'"
fi
as_deploy "touch ~/.ssh/known_hosts && chmod 600 ~/.ssh/known_hosts && { grep -q github.com ~/.ssh/known_hosts || ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null; }"
if [[ ! -d $APP_DIR/.git ]]; then
  echo
  echo "Add this as a READ-ONLY deploy key on GitHub"
  echo "(repo -> Settings -> Deploy keys -> Add deploy key, leave write access off):"
  echo
  cat "$KEY.pub"
  echo
  read -rp "Press Enter once the key is added... "
  as_deploy "git clone $REPO_SSH $APP_DIR"
fi

log "Database role + $ENV_FILE"
if [[ ! -f $ENV_FILE ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  if [[ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_ROLE'")" == 1 ]]; then
    runuser -u postgres -- psql -qc "ALTER ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS'"
  else
    runuser -u postgres -- psql -qc "CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS'"
  fi
  if [[ "$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" != 1 ]]; then
    runuser -u postgres -- createdb -O "$DB_ROLE" "$DB_NAME"
  fi
  # systemd EnvironmentFile: literal KEY=value lines only — no ${...} expansion,
  # no `export`. DATABASE_URL must therefore be fully expanded here. Both
  # services read this one file; the web SSR process only consumes PORT_WEB.
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
PORT_WEB=4000
DEFAULT_PREFIX=!
DATABASE_URL=postgresql://$DB_ROLE:$DB_PASS@localhost:5432/$DB_NAME
DISCORD_BOT_TOKEN=$BOT_TOKEN
DISCORD_CLIENT_ID=$CLIENT_ID
DISCORD_CLIENT_SECRET=$CLIENT_SECRET
DISCORD_PUBLIC_KEY=$PUBLIC_KEY
OWNER=$OWNER_ID
COOKIE_SECRET=$(openssl rand -base64 32)
BACKEND_URL=https://$DOMAIN
CLIENT_URL=https://$DOMAIN
REDIRECT_URI=https://$DOMAIN/api/auth/redirect
CORS_ORIGINS=https://$DOMAIN
EOF
  chown deploy:deploy "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  as_deploy "psql 'postgresql://$DB_ROLE:$DB_PASS@localhost:5432/$DB_NAME' -qc 'select 1' >/dev/null"
else
  echo "$ENV_FILE exists — leaving database and env untouched."
fi

log "Install deps (full — the bot loads @prisma/client & co. from node_modules at runtime)"
as_deploy "cd $APP_DIR && yarn install --immutable"

log "Prisma generate + db push (this repo syncs the schema with db push; the migrations/ dir is stale)"
# No --accept-data-loss on purpose: if a schema change would drop data, db push
# fails loudly and the deploy aborts, rather than silently destroying rows.
as_deploy "cd $APP_DIR && set -a && . ./.env && set +a && yarn prisma generate --schema $SCHEMA && yarn prisma db push --schema $SCHEMA"

log "Build bot, then web (sequential to keep peak memory down)"
as_deploy "cd $APP_DIR && set -a && . ./.env && set +a && yarn nx build bot --configuration production"
as_deploy "cd $APP_DIR && set -a && . ./.env && set +a && yarn nx build web --configuration production"

log "systemd services: $BOT_SERVICE + $WEB_SERVICE"
cp "$APP_DIR/deploy/$BOT_SERVICE.service" /etc/systemd/system/
cp "$APP_DIR/deploy/$WEB_SERVICE.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now "$BOT_SERVICE" "$WEB_SERVICE"
systemctl restart "$BOT_SERVICE" "$WEB_SERVICE"
HEALTHY=0
for _ in $(seq 1 20); do
  sleep 2
  curl -fsS "$HEALTH_URL" >/dev/null && { HEALTHY=1; break; }
done
if [[ $HEALTHY -ne 1 ]]; then
  echo "Bot/API health check FAILED — inspect with: journalctl -u $BOT_SERVICE -n 50" >&2
  exit 1
fi
echo "Bot/API healthy: $HEALTH_URL"

log "Sudoers: deploy may restart the two services and nothing else"
cat > "/etc/sudoers.d/$APP_NAME-deploy" <<EOF
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart $BOT_SERVICE $WEB_SERVICE, /usr/bin/systemctl restart $BOT_SERVICE, /usr/bin/systemctl restart $WEB_SERVICE
EOF
chmod 440 "/etc/sudoers.d/$APP_NAME-deploy"

log "Caddy (HTTP-only on :80 — Nginx Proxy Manager terminates TLS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
curl -fsS "http://localhost/api/health" >/dev/null && echo "Caddy -> bot on :80 OK"
curl -fsS "http://localhost/" >/dev/null && echo "Caddy -> web SSR on :80 OK"

log "Nightly database backups (03:15, keep 14 days)"
install -d "$APP_BASE/bin"
install -m 755 "$APP_DIR/deploy/pg-backup.sh" "$APP_BASE/bin/"
# The cron job runs as postgres, which can't create directories under the
# root-owned /var/backups — pre-create it with the right owner
install -d -o postgres -g postgres -m 700 /var/backups/astolfo
CRON_LINE="15 3 * * * $APP_BASE/bin/pg-backup.sh"
( crontab -l -u postgres 2>/dev/null | grep -vF pg-backup.sh; echo "$CRON_LINE" ) | crontab -u postgres -

IP="$(hostname -I | awk '{print $1}')"
cat <<EOF

============================================================
 $APP_NAME is up inside this container.

 Point Nginx Proxy Manager at it:
   Proxy Host: $DOMAIN
   Scheme http, Forward IP $IP, Forward Port 80
   Websockets Support: ON | Block Common Exploits: ON
   SSL tab: request a Let's Encrypt cert, Force SSL, HTTP/2

 Add the Discord OAuth2 redirect (Developer Portal -> your app ->
 OAuth2 -> Redirects), matching REDIRECT_URI exactly:
   https://$DOMAIN/api/auth/redirect

 Then verify from OUTSIDE your LAN (phone on cellular):
   https://$DOMAIN/api/health   ->  {"status":"UP"}
   https://$DOMAIN/             ->  the dashboard renders
============================================================
EOF
