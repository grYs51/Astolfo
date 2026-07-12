# Scalability, Debuggability & Guardrails

Companion to [CODE_REVIEW.md](CODE_REVIEW.md). That file lists concrete fixes; this one covers the bigger architectural questions:

1. How does this app scale?
2. How do I debug an issue quickly?
3. How do I make the codebase resistant to bad implementations?

---

## 1. Scalability

### 1.1 The core constraint: everything lives in one process

Right now the Discord gateway client, the Express API, the schedulers, and all mutable state (`client.voiceUsers`, `client.userStatus`, `client.guildConfigs`) run in a single Node process. This has three consequences:

- **You can't run two instances.** A second API instance wouldn't have the voice-session cache or the guild cache, and both would double-fire schedulers and double-save metrics.
- **A crash loses in-flight state.** Every open voice session and status duration exists only in a `Map` until the user leaves / the process shuts down cleanly. `uncaughtException` → `process.exit(1)` throws all of it away.
- **The API's latency is coupled to the bot.** A gateway event storm and a dashboard request compete for the same event loop.

**Path to fixing it (in order of effort):**

1. **Persist sessions on open, not on close.** Instead of keeping open voice sessions only in memory, insert a row with `ended_on = NULL` on join and update it on leave (make `ended_on` nullable in the schema). Crash recovery becomes "close all dangling rows at startup" instead of data loss, `activeSessions` becomes a real DB query, and the in-memory map turns into a pure cache.
2. **Externalize hot state to Redis** if you need multi-process later: voice-session cache, status cache, guild-config cache with pub/sub invalidation. This is the prerequisite for splitting processes.
3. **Split API from bot** into two Nx apps. The API currently reaches into `client.guilds.cache` for names/avatars/channels (`getVoiceStatsLeaderboard`, `getVoiceStatsChannels`, `getActiveServers`). Break that dependency by having the bot mirror the entities it cares about (guild name/icon, channel names, member display names) into Postgres tables it keeps updated from gateway events. Then the API is a stateless, horizontally scalable service that only talks to Postgres — and the dashboard also stops showing "Unknown Channel" for channels that fell out of the cache.
4. **Discord sharding** is forced on you at 2,500 guilds anyway (`ShardingManager` / `ClusterManager`). Everything above makes that transition trivial; doing sharding *first* without it is painful.

### 1.2 Database growth

`voice_stats` grows with every join/leave/mute/unmute (one row per state type per session) and `message_stats` grows with every message. The dashboard endpoints aggregate over **all history** on every request (`getVoiceStatsOverview`, `Channels`, `Leaderboard` with `period=all`). That's fine at thousands of rows and painful at tens of millions.

- **Pre-aggregate.** Add a `voice_stats_daily` rollup table (`guild_id, member_id, channel_id, day, total_ms, session_count`) maintained by a nightly job (you already have `node-schedule`). Dashboard queries hit the rollup for anything older than today and only scan raw rows for the current day. This turns every endpoint into an index-range read regardless of history size.
- **Retention policy.** Decide how long raw `message_stats` / `voice_stats` rows matter. Postgres native partitioning by month makes dropping old data instant (`DROP PARTITION` vs. a mega-`DELETE`).
- **Add the missing indexes first** (see CODE_REVIEW §1.1) — cheapest win available.
- **Connection pooling.** One Prisma client is fine for one process; the moment you split API/bot or scale API replicas, put PgBouncer in front (you already run docker-compose, it's one more service).

### 1.3 Caching & request cost

- Dashboard aggregates change slowly (voice stats accrue by the minute, not the millisecond). A 30–60s in-memory TTL cache per `(endpoint, serverId, period)` key would absorb almost all repeated load from a dashboard that fires 6 resources per page view (`detail-overview.component.ts` spawns overview + leaderboard + channels + timeline + heatmap + user-heatmap on load).
- Rate-limit the API (`express-rate-limit`) — each request currently costs multiple aggregate queries plus Discord REST calls.
- Batch Discord REST usage (CODE_REVIEW §2.4) — Discord rate limits are a scaling ceiling you don't control.

### 1.4 Metrics pipeline

Persisting Prometheus text into Postgres every 30s and re-parsing it at boot (`metrics.scheduler.ts`, `load-on-start.ts`) reinvents what Prometheus already does. You already have `prometheus.yml` in the repo — let Prometheus scrape `/api/metrics` and keep history; keep the DB snapshot only for the counter-restore-on-restart trick, or replace that too by computing counters from the DB (commands executed is countable from data you store anyway). Less code, less parsing fragility, real dashboards for free.

---

## 2. Debuggability

### 2.1 Correlation: know *which* request/event a log line belongs to

The single biggest upgrade: **child loggers with context.** Right now `Logger` is a static class over one pino instance, so a log line can't tell you which guild, user, or request produced it.

- **API:** add a request-ID middleware (`crypto.randomUUID()`), stash a child logger on `req.log = logger.child({ reqId, path, userId: req.user?.id })`, and use `req.log` in handlers. Any bug report becomes greppable end-to-end.
- **Bot:** in `BaseEvent.run()`, create `logger.child({ event: this.name, guildId })` and pass it down (or use `AsyncLocalStorage` so nested helpers pick it up automatically). When a voice-state handler throws, you want the log to say *which member in which guild* — today it says nothing (the error isn't even caught, see CODE_REVIEW §4.1).
- Emit key lifecycle logs at `debug` level (voice join/leave/save, status save, config load) and control the level with `LOG_LEVEL` env var. Today you can't turn verbosity up in production without a redeploy.

### 2.2 Central error capture

- Add the **global Express error middleware** (CODE_REVIEW §3) — it's also your debugging chokepoint: one place that logs every API failure with the request context and returns a consistent JSON body.
- Wire an **error tracker** (Sentry has first-class Node + Angular SDKs). Unhandled rejections in event handlers currently vanish into a generic `unhandledRejection` log with no stack context; Sentry gives you grouping, release tagging, and the breadcrumb trail. Free tier covers a hobby bot easily.
- Make `process.on('uncaughtException')` log *synchronously* before exiting (pino async transport can swallow the final line — CODE_REVIEW §8).

### 2.3 Observability you already half-have

- You export Prometheus counters — add **histograms** for the two latencies that matter: API request duration (per route) and event-handler duration (per event type). A "dashboard is slow" report becomes a Grafana lookup instead of guesswork.
- Expand `/api/health` beyond liveness: report DB connectivity (`SELECT 1`), Discord gateway status (`client.ws.status`, ping), cache sizes (`voiceUsers.size`, `userStatus.size`). Cache-size gauges also catch memory leaks (a `voiceUsers` map that only grows = the leave handler is broken).

### 2.4 Local debugging workflow

- Add **VS Code launch configs** (`.vscode/launch.json`) for `nx serve bot` with the inspector attached, so breakpoints work instead of `console.log` archaeology (the stray debug logs found in CODE_REVIEW §7.1 suggest this is the current workflow).
- Create a **seed script** (`prisma/seed.ts`) that populates a few guilds/members/sessions with realistic distributions. Most dashboard bugs (empty heatmaps, timezone shifts, pagination) only reproduce with data; seeding beats clicking around Discord to generate it.
- Keep a `docker-compose` profile that runs *only* Postgres + a seeded DB, so an API bug can be reproduced without a Discord token at all — another payoff of decoupling the API from the client cache (§1.1).

### 2.5 Tests as the debugging tool of record

When you fix a bug, encode the repro as a test (see CODE_REVIEW §9 for where coverage pays off most). The voice-session state machine is the prime candidate: join → mute → change channel → deafen → leave has enough combinations that regressions are otherwise invisible until the data looks wrong weeks later.

---

## 3. Guardrails — making bad implementations hard to write

### 3.1 Let the type system do the reviewing

- **Enable `strict: true`** in `tsconfig.base.json` (at minimum `strictNullChecks` + `noImplicitAny`). The codebase leans on non-null assertions (`message.guildId!`, `oldState.member!`, `process.env.OWNER!`) and implicit `any` (`guildId` in `leaderboard.ts:42`, `metricsData: any`). Strict mode converts a whole class of runtime surprises into compile errors. Migrate incrementally: turn it on, fix per-project, don't allow new violations.
- **One source of truth for API shapes.** The Express handlers build response objects ad hoc and the Angular side re-declares them by hand in `voice-stats.model.ts` / `bot-api.types.ts`. They *will* drift. Move the DTO interfaces into a shared lib (`libs/models` already exists) imported by both sides — then changing a response field breaks the frontend build instead of the frontend runtime.
- **Validate at the boundary with zod** (or similar): request params/query in the API (replacing the hand-rolled `Number.isFinite(rawLimit)` checks duplicated per handler), and one `env.ts` that parses `process.env` at startup and exports a typed config. Everything downstream then trusts its inputs, and a missing `COOKIE_SECRET` fails loudly at boot instead of weirdly at first login.

### 3.2 Enforce architecture with Nx module boundaries

Nx has a built-in lint rule for exactly this: `@nx/enforce-module-boundaries` with tags. Tag projects (`type:app`, `type:feature`, `type:ui`, `type:data-access`, `type:util`; `scope:bot`, `scope:web`, `scope:shared`) and declare rules like:

- `type:ui` may only import `type:ui` / `type:util` (UI components can't grab data-access directly),
- `scope:web` may never import `scope:bot`,
- apps import libs, never other apps.

This makes the layering you already follow *by convention* (`features/*/ui`, `features/*/data-access`, `libs/pages`) impossible to violate accidentally. It's the single highest-leverage guardrail for an Nx monorepo.

### 3.3 Make the right way the easy way

Bad implementations usually happen because the good pattern requires remembering things. Remove the remembering:

- **Route-level middleware instead of per-handler checks.** Once the membership check is middleware (CODE_REVIEW §2.1), a new voice-stats endpoint is secure by construction — mounting it under the router means the author *can't* forget the check.
- **Base classes / helpers that own the cross-cutting behavior.** `BaseEvent.run()` should own the try/catch + logging + metrics so no event author can ship an uncaught handler. Same for a `BaseSlash` wrapper that guarantees the interaction always gets a reply on error.
- **Nx generators for new code.** A small workspace generator for "new API feature endpoint" or "new UI feature lib" stamps out the folder structure, index barrel, spec file, and correct tags — consistency without a checklist. (You already have Nx plugin skills registered in the repo; this is the natural use for them.)

### 3.4 Automated gates in CI

Make the pipeline reject what review would reject:

1. `nx affected -t lint test build typecheck` on every PR — affected-only keeps it fast.
2. **ESLint rules that encode this review:** `no-console` (would have caught §7.1 of the review), naming-convention for file names, `@typescript-eslint/no-floating-promises` (would have caught the unawaited `forEach(async …)` and un-caught event dispatches), `no-non-null-assertion` as a warning to shrink over time.
3. **SonarQube is already configured** (`sonar-project.properties`) — add a quality gate on new-code coverage and duplication so the copy-paste pattern in the voice-stats handlers gets flagged at PR time instead of in a review like this one.
4. **Coverage ratchet:** set the Jest threshold to today's number and raise it as tests land. Never lets coverage silently regress.
5. Pre-commit hooks (husky + lint-staged) for format/lint — cheap, catches the trivial stuff before CI does.

### 3.5 Small process habits that compound

- **PR template** with three checkboxes: "touched an API response shape → updated shared DTO", "added an endpoint → mounted auth middleware", "fixed a bug → added the regression test."
- **ADRs (architecture decision records)** — a `docs/adr/` folder with one short markdown per big decision ("why sessions persist on open", "why API is split from bot"). Six months from now they prevent re-litigating or accidentally undoing the design.
- **Delete dead code aggressively** (commented-out setting flags, the unused side-effect import in `api/index.ts`, leftover TODOs). Dead code is where bad implementations hide, because nobody is sure if it's load-bearing.

---

## Where to start

| Goal | First concrete step |
|---|---|
| Scalability | Make `ended_on` nullable and persist voice sessions on open (§1.1.1) — unlocks crash recovery, real active-session counts, and decoupling |
| Debuggability | Request-ID + child loggers, and the global error middleware (§2.1–2.2) |
| Guardrails | `@nx/enforce-module-boundaries` with tags + `no-floating-promises`/`no-console` lint rules (§3.2, §3.4) |
