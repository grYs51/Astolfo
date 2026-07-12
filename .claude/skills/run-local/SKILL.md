---
name: run-local
description: Run, serve, or test the Astolfo apps locally (bot, web dashboard, database, Storybook). USE WHEN starting the app, reproducing a bug, running tests, or checking which env vars / services a task needs.
---

# Running Locally

Package manager is **yarn**. All tasks go through Nx.

## Services & what they need

| What | Command | Needs |
| --- | --- | --- |
| Postgres only | `yarn docker:dev:database:up` | Docker; also applies migrations |
| Bot + API (port 3000) | `yarn nx serve bot` | Postgres up, full `.env` incl. `DISCORD_BOT_TOKEN` |
| Dashboard (port 4200) | `yarn nx serve web` | Bot API running for real data |
| Storybook (components) | `yarn nx run components:storybook` | Nothing else |
| Full stack in Docker | `yarn docker:dev:up` / `:down` / `:log` | Docker, `.env` |

Env template: `.env.example`. The bot fails at startup without `DATABASE_URL` and `DISCORD_BOT_TOKEN`; the OAuth login flow additionally needs `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `REDIRECT_URI`, `COOKIE_SECRET`.

## Testing / verification

```bash
yarn nx affected -t lint test        # changed projects only
yarn nx run bot:test                 # bot unit tests (jest)
yarn nx run-many -t build            # full build check
```

## Debugging tips

- API is reachable without the frontend: `http://localhost:3000/api/health`, `/api/metrics`. Feature endpoints require an authenticated session cookie (login flow via `/api/auth/...` Discord OAuth) — for pure API work it's often faster to test the SQL in isolation or via a unit test with a mocked `req.db`.
- Startup order in `apps/bot/src/index.ts`: prisma → configs → registries → metrics restore → express → scheduler → discord login. "Database client is not initialized" means something ran before `createPrismaClient()` resolved.
- Bot logs are pino-pretty to stdout. Voice tracking can be exercised by joining/leaving a VC in a test guild; rows land in `voice_stats` only when the session **ends**.
- Ctrl+C triggers the shutdown flush (`shutdown-handler.ts`) — killing the process hard loses open voice sessions and cached statuses.
