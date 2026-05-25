# Astolfo

A Discord bot + Angular dashboard monorepo built with Nx. The bot tracks guild activity (voice, messages, games, presence) and exposes REST APIs consumed by the Angular web app.

## Stack

Angular 21 · NgRx Signals · Discord.js 14 · Express 4 · Prisma 6 · PostgreSQL · ECharts · Tailwind CSS · Pino · Prometheus · Docker · Nx

---

## Apps

### `apps/bot` — Discord Bot + REST API
Discord.js 14 bot with an Express server.

- Registers slash commands, events, and interactions on startup
- Tracks voice sessions, messages, user presence, and game results
- Exposes REST endpoints consumed by the web dashboard
- Exposes Prometheus metrics

**Slash commands:** `ping`, `uptime`, `rock-paper-scissors`, `avatar`, `profile`, and guild/utility commands.

**API routes:**
- `GET /features/active-servers`
- `GET /features/voice-stats/:serverId` — stats, channels, leaderboard, timeline, heatmap, per-user
- `GET /metrics` — Prometheus metrics

### `apps/web` — Angular Dashboard (SSR)
Auth-guarded Angular 21 app with server-side rendering.

**Routes:** `login` → `overview/dashboard` → `overview/detail`

---

## Features

| Feature | Description |
|---|---|
| `features/voice-stats` | Voice activity: leaderboard, timeline, channel breakdown, heatmap (hour × day-of-week), per-user stats |
| `features/active-servers` | Lists active Discord servers the bot is in |

---

## Libs

| Library | Purpose |
|---|---|
| `libs/models` | Prisma schema + generated client (shared DB types) |
| `libs/auth` | `AuthGuard`, Discord OAuth (passport-discord) |
| `libs/pages` | Routed page components: shell, dashboard, detail-overview, login |
| `libs/common` | HTTP interceptors, pipes, NgRx store utilities |
| `libs/components` | Shared Tailwind UI components |
| `libs/tailwind-preset` | Shared Tailwind config preset |

---

## Database

PostgreSQL via Prisma. Key models:

| Model | Description |
|---|---|
| `guild_configs` | Per-guild bot settings (prefix, welcome/goodbye messages, feature toggles) |
| `voice_stats` | Voice channel join/leave records |
| `user_statuses` | Discord presence status history |
| `user_activities` | User activity/game history |
| `message_stats` | Message records per guild/channel |
| `game_type` / `game_result` / `game_player` | Game tracking (rock-paper-scissors, etc.) |
| `session` / `user_session` | Express session store |
| `metrics` | JSON metrics snapshots |

---

## Development

### Prerequisites
- Node.js, Docker

### Commands

```sh
# Start the bot dev server
npm run bot:serve

# Start the web dev server
npm run web:serve

# Start local DB + run migrations
npm run docker:dev:database:up

# Start full dev stack (Docker)
npm run docker:dev:up
npm run docker:dev:down
npm run docker:dev:log

# Prisma
npm run prisma:generate
npm run prisma:migrate

# Visualize the Nx project graph
npx nx graph
```
