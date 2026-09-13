# Production server setup — Astolfo on Proxmox LXC

Create the LXC by hand (Step 1), then `server-setup.sh` automates everything
inside it (Step 2). The remaining steps are UI work: Nginx Proxy Manager, the
Discord Developer Portal, and the GitHub runner. When you see
`astolfo.example.com`, substitute your real domain.

## What you're building

```
Internet → DNS → Nginx Proxy Manager (terminates TLS / Let's Encrypt)
  → LXC "astolfo" (Debian 12, unprivileged) — plain HTTP inside
      Caddy :80
        ├─ /api/*  → the bot's Express API on localhost:3000
        └─ /*      → the Angular SSR server on localhost:4000
      astolfo-bot.service (systemd) — discord.js gateway client + API, user `deploy`
      astolfo-web.service (systemd) — Angular SSR dashboard,          user `deploy`
      PostgreSQL 17 — localhost only, database `astolfo`, role `astolfo`
      GitHub Actions self-hosted runner — deploys automatically on push to main
```

Two things that differ from a plain SPA deploy, and drive everything below:

1. **The bot is one process that is both the Discord client and the API.** If
   `astolfo-bot` is down, the bot goes offline *and* the dashboard's data
   disappears — they share a lifecycle.
2. **The dashboard is server-side rendered (SSR), not static files.** It is a
   real Node process (`server.mjs`) that Caddy reverse-proxies to, exactly like
   the API. There is no folder of static HTML to serve.

- The app lives at `/opt/astolfo/app` (a git clone owned by `deploy`).
- A deploy is just: `deploy/deploy.sh <git-sha>` — fetch, build, sync the
  schema (`prisma db push`), restart both services.
- HTTPS lives entirely in Nginx Proxy Manager. Nothing in this container
  knows about certificates.

Things you need before starting:

- [ ] Nginx Proxy Manager already running and reachable from the internet
- [ ] A domain name with DNS pointing at NPM's public IP
- [ ] A Discord application (Developer Portal): bot token, client ID/secret,
      and your own Discord user ID (for `OWNER`)
- [ ] The GitHub repo (must be **private** — the deploy runner executes
      workflow code on this server)

## Step 1 — Create the LXC (on the Proxmox host)

1. In the Proxmox UI: **Create CT** with:
   - Template: **Debian 12** (standard)
   - **Unprivileged container**: yes (default)
   - Cores: **2** (4 makes the build faster), Memory: **4096 MB**, Swap:
     **2048 MB**. The swap is not optional — the Angular SSR build can OOM
     otherwise (the symptom is a build dying with exit code 137). This
     monorepo builds *two* apps and keeps full `node_modules` for the bot, so
     don't go below 4 GB RAM if you can help it.
   - Disk: **20 GB** (Nx + Angular + Storybook `node_modules` is large, plus
     the Postgres data and nightly dumps)
   - Network: DHCP
2. Start it, note its IP, and add a **DHCP reservation** for its MAC address
   on your router — this is the IP that NPM forwards to, so it must never
   change.

**Verify:** on the Proxmox host, `pct enter <container-id>`, then inside:
`ping -c 3 github.com` succeeds.

## Step 2 — Run the setup script (inside the LXC)

Get `deploy/server-setup.sh` into the container — easiest from the Proxmox
host (with the file copied there first):

```bash
pct push <CTID> server-setup.sh /root/server-setup.sh
pct enter <CTID>
bash /root/server-setup.sh
```

It asks everything up front (domain, Discord credentials), then runs
unattended except for one pause. It installs and verifies, in order: base
packages, the `deploy` user, Node 22 + corepack/yarn 4, PostgreSQL 17 (PGDG
repo), the database role with a generated password, the repo clone, `/opt/
astolfo/app/.env` (secrets generated, `chmod 600`), `yarn install` + Prisma
generate + `db push` + build of **both** apps, the two systemd services
(waits for `/api/health`), the restart-only sudoers rule, Caddy on plain :80,
and the nightly `pg_dump` cron.

**The pause:** the script generates an SSH key and prints the public key.
Add it on GitHub under repo → Settings → **Deploy keys** (read-only), then
press Enter and it clones and continues.

The script is **idempotent** — if it fails partway, just run it again;
completed stages are skipped.

**Verify:** the script exits with a summary block. If it died instead:
`journalctl -u astolfo-bot -n 50` (or `-u astolfo-web`).

## Step 3 — Expose it via Nginx Proxy Manager

In the NPM UI, add a **Proxy Host**:

- Domain: `astolfo.example.com`
- Scheme `http`, Forward IP = the LXC's IP, Forward Port `80`
- **Websockets Support: on**, Block Common Exploits: on
- SSL tab: request a new Let's Encrypt certificate, **Force SSL**, HTTP/2

**Verify from a phone on cellular** (not your wifi):
`https://astolfo.example.com/api/health` returns `{"status":"UP"}` with a valid
certificate padlock, and `https://astolfo.example.com/` renders the dashboard.
A 502 means NPM can't reach the LXC (wrong IP/port); a timeout means DNS or
NPM's own exposure is wrong — neither is this container.

## Step 4 — Discord OAuth for production

The dashboard logs in with Discord (passport-discord). The callback path is
fixed by the code: `/api/auth/redirect`.

1. Discord Developer Portal → your application → **OAuth2** → Redirects →
   add **exactly**:
   `https://astolfo.example.com/api/auth/redirect`
   (any mismatch — http vs https, trailing slash, wrong path — causes an
   invalid-redirect error at login). This must equal `REDIRECT_URI` in
   `/opt/astolfo/app/.env`, which the script already set.
2. Make sure the bot is **invited to at least one server you're in** — the
   dashboard's per-server pages check your membership; a Discord account with
   no shared guild sees nothing.

If you need to change any credential later:

```bash
sudo nano /opt/astolfo/app/.env     # DISCORD_* / OWNER / etc.
sudo systemctl restart astolfo-bot
```

Changing `BACKEND_URL`/`CLIENT_URL`/the domain also requires a **web rebuild**
(BACKEND_URL is compiled into the SSR bundle) — run `deploy/deploy.sh`.

**Verify:** open `https://astolfo.example.com`, complete a Discord login, land
back on the dashboard, and confirm your servers' stats load.

## Step 5 — CI/CD (self-hosted GitHub Actions runner)

The runner makes an _outbound_ connection to GitHub, so no extra ports or SSH
keys are needed. On every push to `main`, GitHub runs your `checks` job on
GitHub's servers, then a `deploy` job on this runner, which executes
`deploy/deploy.sh` locally (fetch → install → generate → db push → build both
→ restart both).

1. GitHub repo → Settings → Actions → Runners → **New self-hosted runner**
   (Linux, x64). Follow the shown commands **as the `deploy` user**
   (`su - deploy`), installing into `/home/deploy/actions-runner`.
2. Install it as a service (as root, from `/home/deploy/actions-runner`):

   ```bash
   ./svc.sh install deploy
   ./svc.sh start
   ```

**Verify:** the runner shows **Idle** on the GitHub Runners page. Push a
trivial commit to `main` and watch Actions: `checks` runs on GitHub, `deploy`
runs on your server, and the site updates.

Security notes: keep the repo **private**; anyone who can push workflow code
can execute commands on this box as `deploy`. The `deploy` user's only sudo
power is restarting the two Astolfo services.

## Step 6 — Backups

The setup script already installed the **nightly database dump** (03:15 as the
`postgres` user, kept 14 days in `/var/backups/astolfo/`). Two things remain:

1. **Whole-container snapshot** (Proxmox host): Datacenter → Backup → add a
   weekly vzdump job for this LXC to storage that is _not_ the same disk
   (NAS/USB), keep 4. This also captures `.env`, the Caddyfile, the runner,
   and the dump directory.

2. **Restore drill — do this once now, so the first real restore isn't also
   the first attempt:**

   ```bash
   sudo systemctl stop astolfo-bot astolfo-web
   sudo -u postgres pg_restore --clean --if-exists -d astolfo /var/backups/astolfo/<latest>.dump
   sudo systemctl start astolfo-bot astolfo-web
   curl localhost:3000/api/health
   ```

   Then log in via the browser and confirm your data is there.

---

## Migrating dev data from Docker → LXC (optional, one-time)

If you've been running the bot locally under `docker compose` and want to carry
that history over, dump the running Postgres container and restore it on the
LXC. The dev role name differs from the prod role (`astolfo`), which the restore
flags below account for.

**1. Dump from the running container** (on your dev machine). Do the dump
*inside* the container and copy the file out — do **not** pipe `pg_dump` through
a PowerShell `>` redirect, which writes UTF-16 and corrupts the binary dump:

```bash
docker exec Astolfo-postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/astolfo.dump'
docker cp Astolfo-postgres:/tmp/astolfo.dump ./astolfo-dev.dump
```

`-U "$POSTGRES_USER"` needs no password (the official image trusts local socket
connections), and `-Fc` is the same custom format `pg-backup.sh` produces.

**2. Copy the dump to the LXC** (`scp astolfo-dev.dump root@<lxc-ip>:/root/`, or
`pct push <CTID> astolfo-dev.dump /root/astolfo-dev.dump` from the Proxmox host).

**3. Restore into the prod DB.** `--no-owner --role=astolfo` re-homes objects
onto the prod role instead of the (absent) dev role:

```bash
sudo systemctl stop astolfo-bot astolfo-web
sudo -u postgres pg_restore --clean --if-exists --no-owner --role=astolfo \
  -d astolfo /root/astolfo-dev.dump
sudo systemctl start astolfo-bot astolfo-web
curl localhost:3000/api/health
```

Ordering note: `server-setup.sh` already created the schema via `prisma db
push`. Restoring with `--clean --if-exists` on top of that is fine — it drops
and recreates each object from the dump. You can also restore *before* the first
`db push` and let the push just confirm the schema matches. Either order works;
don't run them concurrently.

---

## Adding another project

1. Create a new LXC as in Step 1 (new CTID/hostname; size to the project).
2. Copy `server-setup.sh` into the new project, edit the config block at the
   top (repo, paths, DB name, service names), and adjust the build/schema-sync
   commands. Drop the second service if it has no separate frontend.
3. Run it inside the new container, add one more Proxy Host in NPM.

## Day-2 operations

| Task                              | How                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Deploy latest main                | push/merge to `main` — CI does the rest                                                       |
| Deploy a specific version         | on the server, as deploy: `/opt/astolfo/app/deploy/deploy.sh <sha>`                           |
| Roll back bad code                | `git revert <bad-commit>` locally, push to main (or `deploy.sh <last-good-sha>`)              |
| Recover from a bad schema change  | **never roll schema back** — restore last night's dump (drill above), revert the code, re-run `deploy.sh` |
| See bot / API logs                | `journalctl -u astolfo-bot -f`                                                                |
| See dashboard (SSR) logs          | `journalctl -u astolfo-web -f`                                                                |
| See in-container proxy logs       | `journalctl -u caddy -f`                                                                      |
| See TLS/proxy logs                | Nginx Proxy Manager UI → the proxy host's logs                                                |
| Restart just the dashboard        | `sudo systemctl restart astolfo-web`                                                          |
| Edit Caddyfile / systemd units    | edit in the repo, copy to `/etc/...`, reload — these are **not** auto-deployed (need root)     |
| Check health                      | `curl https://astolfo.example.com/api/health`                                                 |

## Gotcha list (things that look broken but aren't, and things that will break)

1. **The bot and the API are one process.** Restarting `astolfo-bot` briefly
   takes the Discord bot offline too. There's no way to bounce the API without
   bouncing the bot — that's by design (`apps/bot` is a single Node process).
2. **`BACKEND_URL` is baked into the web bundle at build time**, not read at
   runtime. Changing the public domain means rebuilding `web` (run
   `deploy/deploy.sh`), not just editing `.env` and restarting.
3. **The Discord redirect URI must exactly equal `REDIRECT_URI`** — https, no
   trailing slash, path `/api/auth/redirect`. #1 cause of login failures.
4. **Deploy dies with exit 137 at the build step** — the Angular SSR build was
   OOM-killed. Confirm the LXC has its 2 GB swap and 4 GB RAM (or set
   `NODE_OPTIONS=--max-old-space-size=3072` for the build).
5. **API returns HTML instead of JSON** — the Caddyfile's `/api/*` handle
   block was merged into the catch-all. Keep them as separate `handle` blocks,
   `/api/*` first.
6. **Dashboard shows a blank page / 502 on `/` but `/api/health` is fine** —
   `astolfo-web` (the SSR process on :4000) is down. `journalctl -u astolfo-web`.
7. **SSR data calls hairpin through NPM.** Server-side renders fetch the API at
   the public `https://<domain>/api/...` (that's what's baked in), so a request
   goes web(:4000) → NPM → Caddy → bot(:3000). It works; it's just not a
   localhost shortcut. Only worth optimizing if SSR latency becomes a problem.
8. **NPM suddenly returns 502** — the LXC's IP changed. This is the missing
   DHCP reservation from Step 1, not an app problem.
9. **Certificate errors** — always NPM's department. Nothing in this container
   touches TLS; don't debug Caddy for cert problems.
10. **The schema is synced with `prisma db push`, not migrations.** The
    `migrations/` directory is stale, so do **not** switch the deploy to
    `prisma migrate deploy` (it would fail or fight the drift). `db push` has
    no down-migrations and no history: a bad schema change means
    restore-from-dump, not rollback. The scripts run `db push` **without**
    `--accept-data-loss`, so a change that would drop data aborts the deploy —
    if that happens, fix the schema, don't add the flag blindly. (Note:
    `apps/bot/Dockerfile.bot` still runs `migrate deploy`; the LXC path
    deliberately does not follow it.)
11. **`.env` uses literal values, not `${...}`.** systemd's `EnvironmentFile`
    does not expand shell variables, so `DATABASE_URL` is written fully
    expanded. Don't "tidy" it into interpolated form.
12. **Full `node_modules` is load-bearing for the bot.** The bot is built with
    `bundle: false`, so it `require()`s its deps at runtime. Don't prune to
    production-only deps at the repo root — the build tools and the bot's
    runtime deps share that tree. (The web SSR bundle, by contrast, is
    self-contained and needs no `node_modules`.)
13. **Unprivileged LXC can't run Docker** in workflows — keep any GitHub
    Actions jobs on this runner Docker-free (run `checks` on GitHub's own
    runners).
