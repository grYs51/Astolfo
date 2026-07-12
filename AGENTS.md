<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project Guide — Astolfo (nx-stolfo)

A Discord bot ("Astolfo") that tracks server activity (voice sessions, presence/status, messages, minigames) plus an Angular dashboard that visualizes it. Nx monorepo, **yarn** as package manager.

## Architecture map

| Piece | Location | Notes |
| --- | --- | --- |
| Discord bot + REST API | `apps/bot` | One Node process: discord.js gateway client **and** Express API (port `PORT`, default 3000) |
| Angular dashboard | `apps/web` | Angular 21, SSR, standalone components, signals |
| Prisma schema | `libs/models/prisma/schema.prisma` | Postgres, snake_case tables/columns |
| Routed pages | `libs/pages` | shell, login, dashboard, detail-overview |
| Shared UI components | `libs/components` | + Storybook |
| HTTP layer base | `libs/common/api` | `ApiBase.get()` wraps `httpResource` with reactive `() =>` params |
| Auth (frontend) | `libs/auth` | guard, profile store, `USER` token |
| Feature libs | `features/<name>/{data-access,ui}` | e.g. `voice-stats`, `active-servers` |

### Bot internals (`apps/bot/src`)

- **Auto-registration**: `utils/registry.ts` scans `commands/`, `events/`, `slashs/`, `interactions/` at startup. Files must default-export a class extending the matching base class in `utils/structures/` (`BaseCommand`, `BaseEvent`, `BaseSlash`, `BaseInteraction`). Dropping a file in the right folder is all that's needed to register it.
- **In-memory state on the client** (`client/client.ts`): `guildConfigs`, `userConfigs`, `userStatus` (presence cache), `voiceUsers` (open voice sessions, key `` `${guildId}:${memberId}` ``). Open sessions exist **only in memory** until the user leaves / shutdown flush (`utils/handlers/shutdown-handler.ts`).
- **Voice tracking flow**: `events/voiceState/voice-state-update.ts` → `utils/handlers/vc/*`. One `voice_stats` row per state type (VOICE, MUTED, DEAF, VIDEO, STREAMING…) per session, written when the state ends. Durations are `ended_on - issued_on` in **milliseconds**.
- **API**: `api/index.ts` (express + session + passport-discord), routes in `api/routes/`, feature routes registered in `api/routes/features/index.ts`. `req.db` is injected by `api/utils.ts/middleware/db.ts`. ⚠️ `api/utils.ts/` is a **directory** literally named `utils.ts`.
- **Metrics**: prom-client counters (`api/utils.ts/counter.ts`), exposed at `/api/metrics`, snapshotted to the `metrics` DB table every 30s, restored on boot (`load-on-start.ts`).

### Frontend patterns

- Data access: extend `ApiBase`, pass **functions** (`() => this.id()`) for reactive params so `httpResource` refetches on signal change. See `features/voice-stats/data-access/src/lib/voice-stats.api.ts`.
- Stores: `@ngrx/signals` `signalStore` + `withFetchOnInit` (`libs/common/store`).
- Charts: ngx-echarts with tree-shaken `echarts/core` imports per component.
- API response DTOs are hand-mirrored in `features/*/data-access/**/*.model.ts` — when changing an Express response shape, update the matching model.

## Commands

```bash
yarn nx serve bot          # run bot + API
yarn nx serve web          # run dashboard
yarn docker:dev:database:up   # Postgres + migrations only
yarn nx run models:prisma-migrate    # create/apply migration after schema edits
yarn nx run models:prisma-generate   # regenerate client
yarn nx affected -t lint test build  # verify changes
```

Required env (`.env`, see `.env.example`): `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `REDIRECT_URI`, `COOKIE_SECRET`, `OWNER`, `DATABASE_URL`, `DEFAULT_PREFIX`.

## Conventions & gotchas

- API handlers use `express-async-handler`; every voice-stats handler starts with a membership check against `voice_stats` (see CODE_REVIEW.md §2.1 for its known flaws before copying it).
- Heavy aggregation belongs in SQL (`$queryRaw` with `Prisma.sql`), not JS reduces — that refactor is done for most endpoints; don't regress it.
- New feature routes must be mounted in `api/routes/features/index.ts` **with `isAuthenticated`**.
- Guild feature toggles are a bitfield (`utils/handlers/settings-handler.ts` `SETTING_FLAGS`).
- Discord IDs are strings everywhere; never parse to number.
- Logger: use `utils/logger.ts` `Logger`, never `console.*`.

## Reference docs (read before re-deriving)

- `CODE_REVIEW.md` — known issues, duplication hotspots, priority table
- `SCALABILITY_AND_MAINTAINABILITY.md` — architecture direction (persist-on-open sessions, API/bot split, rollups)
- `FEATURE_IDEAS.md` — feature backlog with effort ratings and roadmap
- Project skills in `.claude/skills/` — step-by-step recipes for adding endpoints, bot features, dashboard features, and DB migrations
