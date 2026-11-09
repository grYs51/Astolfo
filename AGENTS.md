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
- **In-memory state on the client** (`client/client.ts`): `guildConfigs`, `userConfigs`, `userStatus` (presence cache), `voiceUsers` (open voice sessions, key `` `${guildId}:${memberId}` ``). Voice sessions are **persisted on open**: a row with `ended_on = NULL` is inserted on join and closed on leave / shutdown flush; `voiceUsers` is a pure cache of the open rows. Rows left dangling by a crash are closed at startup (`closeDanglingVoiceSessions`). Statuses work the same way (`utils/handlers/presence/status-save.ts`): a `user_statuses` row is inserted with `ended_at = NULL` when a status starts, closed on the next change or on shutdown (deleted if it lasted under 15 s), and recovered at startup by `closeDanglingStatuses`; each user's writes go through `runSerialized(statusKey(userId))`. Covered by `status-lifecycle.test.ts`.
- **Voice tracking flow**: `events/voiceState/voice-state-update.ts` → `utils/handlers/vc/*`. One `voice_stats` row per state type (VOICE, MUTED, DEAF, VIDEO, STREAMING…) per session, inserted open when the state starts and closed when it ends. Durations are `ended_on - issued_on` in **milliseconds**; SQL aggregations use `COALESCE(ended_on, NOW())` so open sessions count live time, and voice totals must filter `type = 'VOICE'` (the other types overlap it). The other types are used for voice habits (`…/:serverId/voice-habits` leaderboard and `habits` on `getVoiceStatsUser`, SQL in `stats/habits-sql.ts`, shared by the API and the Discord side): they're summed per type with `FILTER` and capped to VOICE. MUTED/DEAF rows already cover server mute/deafen (discord.js `mute` = `serverMute || selfMute`), so never add the SERVER_* rows to them. Handlers for one member run one at a time through `runSerialized(voiceKey(...))` — anything that opens/closes sessions outside `voiceStateUpdate` (`setVc` and the missed-leave cleanup in `events/ready/shard-ready.ts`, which run on every fresh gateway session, and `GuildDelete`) goes through the same queue, and closes always filter `ended_on: null`. Covered by `utils/handlers/vc/voice-lifecycle.test.ts`.
- **API**: `api/index.ts` (express + session + passport-discord), routes in `api/routes/`, feature routes registered in `api/routes/features/index.ts`. `req.db` is injected by `api/utils/middleware/db.ts`.
- **Discord lookups in the API** (membership, server/channel names, member names/avatars) go through `api/utils/discord-directory.ts` — live gateway cache, or fixtures from `dev/mock-discord.ts` when `MOCK_DISCORD=true` (local demo mode: no Discord login, mock OAuth user, seed with `yarn nx run bot:seed`; refused when `NODE_ENV=production`). New handlers should use the directory, not `client.guilds` directly. Statuses have no `guild_id`, so server-wide status views take the member list from `memberIds(guildId)`.
- **Server settings** (`…/servers/:serverId/settings`, `GET` and `PUT` with the whole object): mounted behind `isAuthenticated` + `isServerMember` + `isServerManager` (Manage Server, read from the gateway cache through the directory's `canManage`, since the OAuth tokens aren't stored). Channel pickers offer `postableChannels` (text/announcement channels with `POST_PERMISSIONS`). The page is `overview/detail/:id/settings`. Welcome and goodbye posts (`utils/functions/member-messages.ts`) replace `@member` and only allow the new member's mention, so a message can't ping `@everyone` or roles. Each page save that changes something is logged in `guild_settings_changes` (who, when, field-level from/to; written in the same transaction through `saveGuildConfig`'s `audit` argument) and listed at `…/settings/history`. That list names members even when they hide their stats: it's a log of admin actions, the one exception to the privacy rule below. Chat-command changes aren't logged.
- **Discord-side stats** (`stats/`): SQL for `/stats` and the weekly digest (`queries.ts`, same rules as the API: VOICE rows only, open sessions live, privacy filtered) and the text helpers the cards share (`messages.ts`). The digest runs from `utils/schedulers/digest.scheduler.ts`: an hourly check posts any due recap (Mondays 08:00 UTC), and `guild_configs.digest_last_sent_at` stops it posting twice. Configured with `/digest`. Voice streaks (`getStreaks`: consecutive UTC days with 10+ min of VOICE, gaps-and-islands SQL) and lifetime-hour milestones (`milestones.ts`) feed the stats card, the digest card and the dashboard profile (`getVoiceStatsUser`).
- **Online status and games on the dashboard**: `…/:serverId/presence` (server pulse: average members online per local hour, night owls, early birds) and `…/users/:userId/presence`; `…/:serverId/games` and `…/users/:userId/games` for rock-paper-scissors. Status SQL cuts each interval into the hours it covers (`onlinePieces` in `voice-stats/presence-sql.ts`); "online" means online, idle or dnd. The voice heatmaps cut sessions the same way (`voiceHeatmapCells` in `voice-stats/heatmap-sql.ts`), so a long session counts in every hour it covers, not just the hour it started.
- **Activity calendar** (GitHub-style graph, last 12 months, always regardless of the page period): `…/:serverId/calendar` and `…/users/:userId/calendar` (one handler, `getActivityCalendar.ts`); daily VOICE minutes and messages in the viewer's `tz`, drawn by `feature-voice-stats-activity-calendar` as weeks × weekdays on the shared heatmap chart.
- **Heatmaps** (`feature-voice-stats-heatmap-chart`, `ui/src/lib/heatmap-chart`): one chart for every day-of-week visual (voice heatmaps, server pulse, activity calendar); the caller picks the resolution. Rows are Monday-first top to bottom: map the API's `dayOfWeek` (Postgres DOW, 0 = Sunday) with `weekdayRow` from `heatmap-grid.ts`.
- **Image cards** (`cards/`): the bot's stats replies are PNG cards, not embeds: `/leaderboard`, `/stats`, `/profile` (numbers from `getMemberProfile`), the rock-paper-scissors result, the 5h voice reminder and the weekly digest. Text inside an image can't ping, so messages that mention someone keep the mention as text `content` next to the card. A card is a pure `(data, theme) => svg` template (`*.card.ts`) built from the blocks in `svg.ts`; `cardFile(svg, name)` makes the Discord attachment; `render.ts` turns it into a PNG with `@resvg/resvg-js`, which only sees the fonts in `assets/fonts` and never fetches URLs, so avatars go in as data URIs (`avatars.ts`, initial as fallback). Colours live in `themes.ts` (`DEFAULT_THEME`). Escape every name with `escapeXml`. To tweak a card or theme, run `yarn nx run bot:card-preview` and look at `tmp/cards/`. Cards only draw data that already passed the privacy filter.
- **Metrics**: prom-client counters (`api/utils/counter.ts`), exposed at `/api/metrics` (requires `Authorization: Bearer $METRICS_TOKEN`; disabled when unset), snapshotted to the `metrics` DB table every 30s, restored on boot (`load-on-start.ts`, every `discord_*` counter). The same 30 s save upserts the command counters' running totals (prefix, slash, errors; `DAILY_COUNTERS` in `save-on-exit.ts`) for the UTC day into `metric_daily`; a day's usage is its total minus the previous day's. `discord_bot_command_errors_total{name}` counts commands that threw (`base-command.ts`, `base-slash.ts`). `discord_api_requests_total{method,route,status}` and the `api_request_duration_seconds` histogram (no `discord_` prefix, so since the last restart) come from `api/utils/middleware/requestMetrics.ts`; `route` is the route pattern, never the URL, or `unmatched`.
- **Owner admin page** (`/overview/admin`, `features/admin/*`, `libs/pages/src/admin`): `GET /admin/{health,servers,usage,people,web}` in `api/routes/admin/`, each behind `isAuthenticated` + `isOwner` (`req.user.id === OWNER`, 403 otherwise; a test checks every `/admin` route has both). `/auth/status` returns `isOwner`, which drives the web `OwnerGuard` and the navbar link; those only hide the page, the API is the lock. Counts and server names only, so no privacy filter. Data: `guild_events` (`join`/`leave`, written by `GuildCreate`/`GuildDelete`; discord.js only fires `GuildCreate` for real joins after ready), `metric_daily`, `page_views`, `user_session.created_at`/`last_login_at` (set at login; NULL = before tracking), and `startupStats` (`utils/startup-stats.ts`: commit, sessions recovered at startup).
- **Page views**: the shell posts the matched **route pattern** (`overview/detail/:id`, built from the snapshot's `routeConfig` paths) to `POST /features/track` on each navigation to a new path (a `?tab=` change doesn't count), browser only and logged in only. The handler refuses anything that isn't `^[a-zA-Z0-9/:_-]{1,100}$` or contains a 15+ digit run (a Discord id), so ids never land in `page_views` (one row per day, pattern and user).

### Frontend patterns

- Data access: extend `ApiBase`, pass **functions** (`() => this.id()`) for reactive params so `httpResource` refetches on signal change. See `features/voice-stats/data-access/src/lib/voice-stats.api.ts`.
- Stores: `@ngrx/signals` `signalStore` + `withFetchOnInit` (`libs/common/store`).
- Charts: ngx-echarts with tree-shaken `echarts/core` imports per component.
- API response DTOs live in `libs/api-interfaces` (`@nx-stolfo/api-interfaces`), imported by **both** the Express handlers (which type their responses with them) and the Angular data-access libs — changing a response shape breaks the build of whichever side no longer matches.

## Commands

```bash
yarn nx serve bot          # run bot + API
yarn nx serve web          # run dashboard
yarn docker:dev:database:up   # Postgres + migrations only
yarn nx run models:prisma-migrate    # create/apply migration after schema edits
yarn nx run models:prisma-generate   # regenerate client
yarn nx affected -t lint test build  # verify changes
```

Required env (`.env`, see `.env.example`): `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `REDIRECT_URI`, `CLIENT_URL`, `COOKIE_SECRET`, `OWNER`, `DATABASE_URL`, `DEFAULT_PREFIX`. Optional: `METRICS_TOKEN`, `CORS_ORIGINS`, `MOCK_DISCORD` (with it, only `DATABASE_URL`, `COOKIE_SECRET` and `CLIENT_URL` are required). The web app's production API URL is a literal in `apps/web/src/environments/environment.ts` (the browser bundle can't read env vars).

## Conventions & gotchas

- API handlers use `express-async-handler`; voice-stats routes are mounted behind `isAuthenticated` + `isServerMember` (real guild membership via the Discord directory), so handlers don't re-check access.
- Heavy aggregation belongs in SQL (`$queryRaw` with `Prisma.sql`), not JS reduces — that refactor is done for most endpoints; don't regress it.
- New feature routes must be mounted in `api/routes/features/index.ts` **with `isAuthenticated`**.
- **Member privacy:** members can hide from other members (`user_configs.privacy_hidden`, set via `/features/me/privacy`). Any query that lists or names members (leaderboards, companions, live list, rankings) must add `visibleMembersOnly(column, viewerId)`; endpoints about one member must return 403 when `isHiddenFrom(db, memberId, viewerId)` (both in `utils/privacy.ts`, re-exported from `routes/features/helpers.ts`; for output everyone sees, such as a channel post, pass an empty viewerId so every hidden member is left out). Anonymous totals may include hidden members; viewers always see themselves. The one exception is the settings audit log (see Server settings), which names whoever changed a setting.
- Guild feature toggles are a bitfield (`utils/handlers/settings-handler.ts` `SETTING_FLAGS`).
- New code writes `guild_configs` through `saveGuildConfig(client, guildId, data)` (`utils/functions/set-config.ts`), which also updates `client.guildConfigs` so the bot sees the change at once. The old chat commands, `guild-create.ts` and the digest scheduler still do their own writes.
- Discord IDs are strings everywhere; never parse to number.
- Logger: use `utils/logger.ts` `Logger`, never `console.*`.
- **Guardrails:** the bot is `strict` TypeScript (prefer narrowing over `!`); lint enforces module boundaries by tag (`type:*` layering, and the bot (`platform:node`) may only import `scope:shared` libs: `api-interfaces`, `models`), `no-console`, and `no-floating-promises` in the bot. New libs need `type:` tags (plus `scope:shared` if the bot uses them). The database is pinned to UTC (migration `database_timezone_utc`, checked at startup by `assertUtcTimeZone`), so `NOW()` matches the UTC timestamps; in new SQL prefer `NOW_UTC` (`voice-stats/presence-sql.ts`), which doesn't depend on the session time zone.

## Reference docs (read before re-deriving)

- `CODE_REVIEW.md` — known issues, duplication hotspots, priority table
- `SCALABILITY_AND_MAINTAINABILITY.md` — architecture direction (persist-on-open sessions, API/bot split, rollups)
- `FEATURE_IDEAS.md` — feature backlog with effort ratings and roadmap
- Project skills in `.claude/skills/` — step-by-step recipes for adding endpoints, bot features, dashboard features, and DB migrations
