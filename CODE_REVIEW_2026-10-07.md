# Code Review — 2026-10-07

Branch: `feat/dashboard` @ `56301f1` · Scope: `apps/bot`, `apps/web`, `libs/`, `features/`, Prisma schema/migrations, `deploy/`, CI, tooling.

This is a follow-up to [CODE_REVIEW.md](CODE_REVIEW.md) (2026-07-04). Most of that review has since been addressed — see [§7 Status of the previous review](#7-status-of-the-previous-review). The findings below are **new** (or residual parts of old items), with the persist-on-open voice session refactor being the main source of new correctness risk.

> **Fixed since writing (2026-10-07, uncommitted):** 1.1, 1.2, 1.3 (user heatmap now SQL, both sides bucket by UTC), 2.1, 2.2 (per-member serialization via `runSerialized`, join closes stale entries), 2.3, 2.4, 2.5, 2.6, 4.1 (production `BACKEND_URL` is now the literal `https://astolfo-api.grys.dev`; prod serves the API from that separate host, and `/api/*` on the dashboard domain goes to the Angular server, so a relative `/api` would not work), 5.2, and from 2.11 the `cancelJob` `try/finally` and `setVc` caching only after its insert. Everything else below is still open.

Severity: **High** = wrong data, broken prod, or security hole · **Medium** = real bug with narrower trigger, or notable perf/ops risk · **Low** = edge case, hygiene, consistency. Items marked *(plausible)* depend on timing or environment that couldn't be confirmed statically.

---

## Top priorities

| # | Severity | Finding | Where |
|---|---|---|---|
| 1.1 | High | Voice-stats totals sum **every state type** (VOICE + MUTED + DEAF…) → time double/triple counted | voice-stats SQL handlers |
| 2.1 | High | Concurrent per-type closes corrupt the `voiceUsers` cache (index computed before `await`, `splice` after) | `voice-db.ts:34-46` |
| 2.2 | High | Join/leave not serialized per user; cache mutated after DB awaits → rows left open forever | `voice-changes.ts`, `voice-db.ts` |
| 2.3 | High | Close `updateMany` doesn't filter `ended_on: null` → correct end times get overwritten | `voice-db.ts:16,41`, `set-vc.ts:64` |
| 2.4 | High | Crash-recovery cutoff can be overwritten by the metrics scheduler before it's read | `index.ts:57-58` |
| 2.5 | High | `setprefix` / `setwelcomechannel` have no permission check — any member can run them | `commands/mod/*` |
| 4.1 | High | Production web bundle contains raw `process.env.BACKEND_URL` → `ReferenceError` in browser | `apps/web/src/environments/environment.ts:2` |
| 5.1 | High | Caddy doesn't trust NPM's forwarded headers → secure cookie never set, one shared rate-limit bucket *(very likely)* | `deploy/Caddyfile`, `api/index.ts` |
| 5.2 | High | Nightly backup script can't create its directory as `postgres` → no backups *(verify on host)* | `deploy/pg-backup.sh:13` |
| 5.3 | High | Documented CI deploy doesn't exist; actual workflow runs `docker compose` on the self-hosted runner | `.github/workflows/image-build.yml` |

Quick wins with outsized impact: **1.1** (one `AND type = 'VOICE'` per query), **2.3** (one extra `where` clause), **2.4** (move one call), **2.5** (one permission check).

---

## 1. API — `apps/bot/src/api`

Verified clean: no `$queryRawUnsafe` / `Prisma.raw` (all interpolation is parameterized; `DATE_TRUNC` unit is whitelisted), every BigInt is wrapped in `Number()`, every feature route has `isAuthenticated`, every voice-stats route has `isServerMember`, handler responses match `libs/api-interfaces` DTOs.

### 1.1 [High] Totals sum all voice-state types — time is double/triple counted
Missing `type = 'VOICE'` filter in:
- `getVoiceStatsLeaderboard.ts:42-47`
- `getVoiceStatsOverview.ts:27-32` (totals) and `:39-45` (top channel)
- `getVoiceStatsChannels.ts:22-27`
- `getVoiceStatsUser.ts:25-38`
- `getVoiceStatsTimeline.ts:42-48`
- `getVoiceStatsUserHeatmap.ts:38-46`, `:62-67`

A join inserts one VOICE row **plus** one row per active state (MUTED, DEAF, VIDEO, STREAMING) with the same `issued_on` (`voice-changes.ts:35-47`). These queries sum all of them.

**Scenario:** user sits self-deafened for 2h → VOICE + MUTED + DEAF rows → leaderboard shows **6h** and `sessionCount = 3`. AFK/deafened users rank highest. Meanwhile `getActiveServers.ts:25` and `getVoiceStatsHeatmap.ts:43` *do* filter on VOICE, so endpoints disagree.

**Fix:** add `AND type = ${VOICE_TYPE.VOICE}` to all of the above. Keep the all-types grouping only for the overview's `activityBreakdown`.

### 1.2 [Medium] Heatmaps exclude open sessions
`getVoiceStatsHeatmap.ts:38,44`, `getVoiceStatsUserHeatmap.ts:62,67` (and JS path `:90`) use `ended_on - issued_on` with `ended_on IS NOT NULL` — violates the project's `COALESCE(ended_on, NOW())` rule. A live 5h session shows on overview/timeline but not on either heatmap, then jumps in when the user leaves.

### 1.3 [Medium] User heatmap still aggregates in JS (residual of old §2.3 / §2.7)
`getVoiceStatsUserHeatmap.ts:38-46` does an unbounded `findMany` (all columns, no limit for `period=all`), then buckets with `getHours()`/`getDay()` (`:98-99`) in **Node's** timezone, while the server-average side uses SQL `EXTRACT` on stored UTC. It also floors per session (`:95`) vs `::int` rounding the sum on the server side. Reuse the server SQL with `AND member_id = ${userId}`.

### 1.4 [Low] Server-average denominator is wrong in the user heatmap
`getVoiceStatsUserHeatmap.ts:82,154`: `avgPerUser` divides by the **max per-cell** unique-user count, not distinct users in the period → average inflated → `aboveAverage` false too often. Use `COUNT(DISTINCT member_id)` over the period.

### 1.5 [Low] Input validation gaps
- `getVoiceStats.ts:10-13`, `getVoiceStatsLeaderboard.ts:16-17`: `Number.isFinite` accepts `10.5` / `1e300` → Prisma `take`/`skip` validation error → 500. Use `Number.isInteger` and cap `offset`.
- `getVoiceStatsHeatmap.ts:14-20`: `period` cast without whitelist — `?period=foo` means no lower bound (full-history scan), while omitting it defaults to `month`. Whitelist like `getVoiceStatsUserHeatmap.ts:29-32`.
- `getVoiceStats.ts:22`: `orderBy` on `issued_on` only; rows from one join share it → unstable pages. Add `{ id: 'asc' }` tie-breaker.

### 1.6 [Low] Auth / session hardening
- **No OAuth `state`** (`discordStrategy.ts:28-33`) → login CSRF (victim's browser logged in as attacker). Set `state: true`.
- **Logout is a GET** (`routes/discord/index.ts:18-20`) → cross-site top-level navigation logs users out. Make it POST.
- **`isServerMember.ts:34`** `.catch(() => null)` maps Discord 429/5xx/timeouts to **403**. Only treat `DiscordAPIError` 10007 (Unknown Member) as forbidden; otherwise 503 / `next(err)`.
- **`/auth/status`** (`getStatus.ts:12`) hits Discord on every call and never uses `refresh_token`; token lifetime (7d) equals cookie `maxAge`, so after expiry `/auth/status` 401s while feature endpoints still 200.
- **Plaintext tokens** still stored (`discordStrategy.ts:45-50`) — residual of old §1.4.

### 1.7 [Low] Env validation runs too late / incomplete
- `index.ts:14` imports `./api`, which constructs the passport strategy (`discordStrategy.ts:26-33`) **before** `validateEnv()` (`index.ts:45`). Missing `DISCORD_CLIENT_ID` → `TypeError: OAuth2Strategy requires a clientID option` instead of the clear message. Register the strategy inside `createExpress()`.
- `CLIENT_URL` (used in `redirect.ts:6`, `logout.ts:8`) and `DEFAULT_PREFIX` (AGENTS.md lists it as required) are not in `validate-env.ts`. Missing `CLIENT_URL` → redirect to `/api/auth/undefined`.

### 1.8 [Low] `/api/metrics` is public and unwrapped
`routes/metrics/index.ts:5`, `get-metrics.ts:4-8`: no auth (Caddy proxies all `/api/*`), exposing heap/process stats and command counters. The async handler isn't wrapped in `asyncHandler` (Express 4 → a rejection hangs the request). Block in Caddy, require a token, or serve on a localhost-only port.

### 1.9 [Low] Misc
- `error-handler.ts:15-23` only honours `HttpError` status; framework errors with `err.status` 4xx (e.g. body-parser 400) become 500.
- `index.ts:21-25`: `CORS_ORIGINS=""` yields `[]` (not the default) — `??` doesn't fall back on an empty array → browser API fully blocked.
- Single global rate limiter (`index.ts:45-52`); heavy aggregate routes have no stricter limit. `trust proxy` only set in production.
- `load-on-start.ts:47-52`: legacy text-format metrics row is skipped then overwritten → historical counters lost once on upgrade (accept + document, or one-time parse).
- `getVoiceStatsOverview.ts:25-57`: three independent queries run sequentially — `Promise.all`.
- `getVoiceStatsHeatmap.ts:33`, `getVoiceStatsLeaderboard.ts:38`, `getVoiceStatsUserHeatmap.ts:57` use `currentClient` instead of `req.db` (blocks the planned mocked-`req.db` tests).
- Comment at `getVoiceStatsHeatmap.ts:23-24` is wrong: `EXTRACT` on `timestamp` (no tz) yields the stored UTC hour.
- `save-metrics.ts` is a dead stub; `@types/express.d.ts:42` declares `user?: any`, overriding the typed `Express.User`.
- Active-servers `totalDuration` is in **seconds**, every other endpoint uses ms (documented, but inconsistent).
- *(Confirm intent)* Any guild member can read any other member's per-user stats via `users/:userId[/heatmap]`.

---

## 2. Bot runtime — `apps/bot/src` (excluding `api/`)

The persist-on-open lifecycle is the right design, but the in-memory cache and DB writes aren't kept consistent under concurrency. Fixes 2.3 and 2.4 are cheap backstops worth doing first; 2.1/2.2 are the structural fix.

### 2.1 [High] Concurrent per-type closes corrupt the cache
`voice-db.ts:34-46` computes `idx` **before** `await updateMany`, then `splice(idx, 1)` after. `voice-changes.ts:96-99` runs several of these concurrently on the same array via `Promise.all`.

**Scenario:** undeafen closes DEAF (idx 1) and MUTED (idx 2) at once. If DEAF resolves first, `splice(1)` → `[VOICE, MUTED]`, then `splice(2)` is a no-op → closed MUTED row stays cached. Next mute appends a second MUTED; next unmute's `findIndex` hits the stale row and overwrites its `ended_on` (with 2.3) → inflated muted time.

**Fix:** remove entries by id synchronously **before** awaiting (`stats = stats.filter(s => !closing.has(s.id))`), and close all ended types in one `updateMany`.

### 2.2 [High] Join/leave races — cache mutated after DB awaits, no per-user serialization
`voice-changes.ts:48-52` (join), `voice-db.ts:16-20` (leave).
- **Leave → fast rejoin:** leave captures `[A]` and awaits; join inserts B and sets cache `[A, B]`; leave resolves and `voiceUsers.delete(k)` wipes B. Row B stays open and the API counts it live via `COALESCE(NOW())` until restart.
- **Join → leave within one `createMany` round-trip:** leave sees an empty cache and no-ops; join then caches the row, which stays open until the next leave (gap counted as voice time). Same for join → quick unmute.

**Fix:** serialize events per `voiceKey` (a promise chain per key), and make join close any stale cached entries instead of appending (`[...existing, ...newStats]` in `voice-changes.ts:51-52`, `set-vc.ts:26-27`).

### 2.3 [High] Closes can overwrite an already-correct `ended_on`
`voice-db.ts:16-19`, `voice-db.ts:41-44`, `set-vc.ts:64-67` filter on id only. Any stale cached row (2.1, 2.2, 2.6, 2.9) gets its `ended_on` rewritten later — e.g. MUTED closed at 12:00 rewritten to the 15:00 leave → +3h muted.

**Fix:** add `ended_on: null` to every close `where`. Independent of 2.1/2.2, near-zero cost.

### 2.4 [High] Crash-recovery cutoff contaminated by the metrics scheduler
`index.ts:57-58` starts `startMetricsScheduler()` **before** `client.login()`; `closeDanglingVoiceSessions` (`voice-db.ts:58-69`) only runs at `ClientReady` (`client-ready.ts:19`) and uses the latest `metrics.updated_at` as the cutoff. Any 30s tick during login sets that to "now".

**Scenario:** bot crashes, is down 2h, restarts; a tick fires during the gateway handshake → all dangling sessions closed at boot time → 2h of downtime recorded as voice time for everyone who was in voice.

**Fix:** run `closeDanglingVoiceSessions` in `main()` before `startMetricsScheduler()` — it needs only the DB. This also fixes 2.6 and stops the API counting dangling rows live during login.

### 2.5 [High · Security] Guild-config commands have no permission check
`commands/mod/set-prefix.ts:12-42`, `commands/mod/set-welcomechannel.ts:12-40`; `BaseCommand.run` (`base-command.ts`) enforces nothing. Any member can `,setprefix x` (breaking the admins' prefix) or redirect welcome messages.

**Fix:** add a `permissions` field to `BaseCommand` enforced in `run()`; require `ManageGuild` for `mod` commands.

### 2.6 [Medium] Startup race between replayed gateway events and `ReadyEvent` *(plausible timing)*
discord.js replays queued dispatches right after emitting `ClientReady`, while `ReadyEvent` is still awaiting `closeDanglingVoiceSessions`. A user joining during boot: join inserts+caches → dangling close sets it to 0 duration → `setVc` appends a second VOICE set → on leave both are updated (with 2.3, double-counted). Fixed by 2.4; also make `setVc` skip keys already in `voiceUsers`.

### 2.7 [Medium] Leaderboard slash-command correctness
- `activeLeaderboard.ts:39-45` + `currentLeaderboard.ts:13`: only open **VOICE** rows are merged from cache; open MUTED/DEAF are dropped → a user deafened for 4h in a still-open session gets 4h "active".
- `inactiveLeaderboard.ts:48-90`: old §5.2 bug persists here — DEAF + MUTED both summed → 1h deafened shows as 2h inactive. Reuse `deductedOverlap`.
- `currentLeaderboard.ts:9-17`, `inactiveLeaderboard.ts:32-43`, `lonerLeaderboard.ts:25-29`: cached open rows aren't clipped to the time range → `time-range:today` with a session open 3 days credits 72h. Clip to `max(issued_on, fromTime)`.
- `lonerLeaderboard.ts:43`, `inactiveLeaderboard.ts:81`, `leaderboard.ts:114`: `members.find(...)!.user.username` throws for departed/uncached members → `/leaderboard type:loner` permanently errors once any ex-member has history. Use a Map and skip misses (as active/current do).

### 2.8 [Medium] Unawaited promises escape the new `BaseEvent` catch
`events/message/message-create.ts:15-16` (`saveMessage`, `runCommand` — i.e. every prefix-command error), `guild-member-add.ts:25` (`channel.send`), `voice-channel.scheduler.ts:27`, `slashs/utils/modal.ts:51` → context-free global "Unhandled rejection".

### 2.9 [Medium] No `GuildDelete` handling; missed leaves never reconciled
No handler exists. Bot kicked while 5 users are in voice → their rows accrue live time for days and their 5h reminder jobs still fire. Add a `GuildDelete` handler closing every `${guildId}:` key and cancelling jobs; consider reconciling `voiceUsers` against `channel.members` on `ShardResume`.

### 2.10 [Medium] `BaseSlash.deferType` is never honoured
`base-slash.ts:16,29` — unused anywhere. `/profile` (`slashs/user/profile.ts:45-63,123`) runs three serial queries (one a full-history `findMany`) before replying; past 3s the token expires and `InterActionUtils.send` swallows `UnknownInteraction` → "The application did not respond". Defer in `BaseSlash.run` / `interaction-create.ts`.

### 2.11 [Low] Misc bot
- `profile.ts:105-108`: favourite-channel `reduce` seeded with `0` → always "No channel found". Seed `['', 0]`.
- `voice-changes.ts:20-21`: if leave's `updateMany` throws, `cancelJob` never runs → reminder pings a user who left. Use `try/finally`.
- `client-ready.ts:19-26`: one failing step skips `setStatusCache`, `setVc`, `checkForNewGuilds` — isolate like `shutdown-handler.ts`'s `step()`. `set-vc.ts:27,52` caches rows **before** `createMany`; on insert failure later closes update 0 rows silently.
- Prefix defaults disagree: `guild-create.ts:20` (`DEFAULT_PREFIX!`, schema default `'!'` if unset), `set-config.ts:34,43` (`','`), `generate-guild-config.ts:30` (`process.env.PREFIX`). One shared constant.
- `generate-guild-config.ts:18-42`, `generate-user-config.ts:18-37`: `forEach(async …)` (old §4.5 pattern) — ✅ reacted before work completes.
- `registry.ts:35,43` registers slashes/interactions as `client.on(name)` listeners — never fire, and a slash named `error`/`ready`/`warn` would run on those client events. Drop them.
- Bot filtering inconsistent: `set-status.ts:8` skips bots, presence updates don't, voice handlers never do (music bots get voice rows).
- *(plausible)* `oldState.member!.id` (`voice-changes.ts:20-21`) — `member` can be null; use `oldState.id`.
- `shutdown-handler.ts:63-67`: in-flight leave updates get overwritten by `saveVc` with the shutdown time (fixed by 2.3).

---

## 3. Database & timezones

### 3.1 [Medium] Live durations depend on the DB session timezone *(plausible on prod)*
`voice_stats.issued_on/ended_on` are `Timestamp(6)` **without** time zone (`schema.prisma:26-29`); Prisma writes UTC wall-clock. `COALESCE(ended_on, NOW())` promotes to `timestamptz`, so `issued_on` is reinterpreted in the session `TimeZone`. Dev Docker Postgres defaults to UTC (hides it); a PGDG cluster on a Europe/Brussels host would show open sessions ~+2h. Same issue for the raw `${cutoff}` bind in `closeDanglingVoiceSessions` (`voice-db.ts:65-68`).

**Fix:** `ALTER DATABASE astolfo SET timezone TO 'UTC'` in `server-setup.sh` (simplest), or `NOW() AT TIME ZONE 'UTC'`, or migrate columns to `timestamptz`.

### 3.2 [Medium] Four schema-sync mechanisms in use
LXC deploy uses `db push` (`deploy.sh:42`, `server-setup.sh:151`); `Dockerfile.bot:52` uses `migrate deploy`; `docker:dev:database:up` uses `migrate dev`; AGENTS.md says `prisma-migrate`. The 19 migrations in `libs/models/prisma/migrations/` **do** reproduce `schema.prisma` exactly (including `20260913161500_voice_stats_ended_on_nullable`), so the "migrations are stale" comments in `deploy.sh:39`, `server-setup.sh:148`, `setup-server.md:280` are now false.

Consequences: Docker image against a db-pushed DB → P3005 crash loop; `migrate dev` on a db-pushed dev DB offers a destructive reset; a hand-written partial index would be silently dropped by `db push`.

**Fix:** pick one. Since migrations are in sync, baseline prod (`prisma migrate resolve --applied …`) and switch deploy to `migrate deploy`.

### 3.3 [Low] Indexes
- `voice_stats`: `closeDanglingVoiceSessions` (`WHERE ended_on IS NULL`) and the active-session count scan the table — a partial index `ON voice_stats (guild_id) WHERE ended_on IS NULL` (needs a migration; another reason to drop `db push`, see 3.2).
- `game_player(user_id)` / `(game_result_id)` unindexed but queried by `/profile` (`profile.ts:124`); `user_activities` has none.
- `binaryTargets` includes dead `rhel-openssl-1.0.x` (`schema.prisma:3`).

---

## 4. Frontend — Angular

Verified clean: all resource params passed reactively as `() =>`, no refetch loops, ngx-echarts disposes instances, echarts tree-shaken in all four chart components, no stray `console.log`, OnPush everywhere.

### 4.1 [High] Production bundle references `process.env` in the browser
`apps/web/src/environments/environment.ts:2` is `BACKEND_URL: process.env["BACKEND_URL"]`. The production config in `apps/web/project.json` has no `fileReplacements` and no `define` (removed in ae10380). The existing `dist/apps/web/browser/main-*.js` contains `BACKEND_URL:process.env.BACKEND_URL` with no `process` polyfill → **`ReferenceError: process is not defined`** on load; the app never bootstraps client-side.

`deploy.sh:45` and `setup-server.md:134` claim BACKEND_URL is "baked into the web bundle" — nothing does that. `Dockerfile.web:16` writes an `environment.prod.ts` nothing reads.

**Fix:** since Caddy serves `/api/*` and the web app from one origin, the browser can use a relative base (`''` / `/api`) and only SSR needs an absolute URL. Otherwise restore a production `fileReplacements` → generated `environment.prod.ts`, or use `define`.

### 4.2 [Medium] No 401 handling after initial auth check
`credential.interceptor.ts:3-8`, `fetch-on-init.feature.ts:28-34`, `is-logged-in.guard.ts:19-26`. Session expiry mid-use → every card shows "Failed to load…" and the guard keeps letting the user through (`ProfileStore.value` stays set). Conversely, a Discord 429/5xx forwarded by `/auth/status` is treated as "logged out" → valid users bounced to `/login`. Catch 401 in the interceptor → `/login`; only 401 on `/auth/status` means logged out.

### 4.3 [Medium] Timeline/heatmap timezone handling
- `voice-stats-timeline.component.ts:164-174`: backend sends UTC wall-clock strings (`getVoiceStatsTimeline.ts:57-58`). Hourly labels show the UTC substring; daily does `new Date('YYYY-MM-DD')` (UTC midnight) then reads local `getMonth()/getDate()` → **every daily label one day early** for UTC− users; weekly shows the raw string.
- Heatmaps (`voice-stats-heatmap.component.ts:55-57`, `voice-stats-user-heatmap.component.ts:76-78`, `heatmap-grid.ts:14-18`) plot UTC hours unlabelled — a UTC+2 user's 20:00 shows at 18:00.

**Fix:** decide on one convention (send ISO with `Z` and convert to local, or pass a `tz` param to the API) and label axes.

### 4.4 [Medium] Timeline drops empty buckets
`voice-stats-timeline.component.ts:52,85-87` with `getVoiceStatsTimeline.ts:39-51`: category axis over only non-empty buckets → 3 active days in a week render as 3 consecutive bars; hourly+month is up to 720 bars labelled "14:00" with no date; `avgUsers` averages active buckets only. Zero-fill (client-side or `generate_series`) or use `xAxis.type: 'time'`.

### 4.5 [Medium] Accessibility — the main navigation isn't keyboard-reachable
`active-servers-list.component.html:16`, `active-servers-card.component.html:3-5`: server selection is `(click)` on a plain div — no role, tabindex, or link. Render as `<a [routerLink]="['/overview/detail', guild.id]">`.

### 4.6 [Medium] UI lib fetches data
`active-servers-list.component.ts:21,28` provides/injects `ActiveServerStore` inside a `ui` lib — breaks the presentational-only convention and makes Storybook/tests need HTTP. Lift to `libs/pages/.../dashboard.component.ts`.

### 4.7 [Low] Frontend misc
- **Breadcrumbs never render** — `shell.component.ts:41-46` reads `data` from the `overview` route, which has none (`app.routes.ts:10-27`); `routerLink="overview"` in `breadcrumbs.component.html:5` is relative. `dashboard.routes.ts:15-18` has a bogus "detail-overview" crumb.
- **Channel icons always fallback** — `voice-stats-channels.component.ts:17-25` keys on `voice`/`stage`, backend sends `ChannelType[...]` names (`GuildVoice`, `GuildStageVoice`) (`helpers.ts:39`).
- `active-servers-card.component.html:6-14`: null `icon`/`name` → broken `<img src="null">`, empty title.
- `detail-overview.component.html:157,183`: child `[loading]` inputs are always `false` (inside the `hasValue()` branch) → child skeletons dead; every filter change swaps the whole card for the page skeleton (layout jump).
- `leaderboard-item.component.ts:11-14`: rows are `role="button"` + `tabindex="0"` but `(userClick)` is never bound.
- `is-logged-in.guard.ts:15`: `toObservable()` per guard run leaks a root-injector effect each navigation.
- Types duplicated locally instead of from `@nx-stolfo/api-interfaces` (`detail-overview.component.ts:24-27`, `voice-stats.api.ts:53,88-89,109,128`); `DiscordUser` lives in `common/api`; backend `getStatus` is typed `unknown`.
- `navbar.stories.ts:18-33`: required `loginUrl` input missing → `LoggedOut` story throws NG0950.
- `collapsible-card.component.ts:72` reads input at construction (use `linkedSignal`); nested button in `role="button"`; `card.component.ts` unclosed `<div>`.
- `DiscordImagePipe` (`discord-image.pipe.ts:11`) uses `Math.random()` for default avatars — use `(BigInt(id) >> 22n) % 6n`.
- Navbar logo `href="/"` full-reloads; `SegmentedControl` misuses `tablist`; `ProgressBar` lacks `role="progressbar"`; charts have no `aria` text.
- SSR is effectively off (`app.routes.server.ts:3-8` → `RenderMode.Client` for `**`), so hydration/server-token code is dead. Document; if SSR is enabled later, the guard returns `false` server-side and server `httpResource` calls go without cookies.
- **Dead code:** Card, CollapsibleCard, Badge, Button, ButtonGroup, `VoiceStatsOverviewComponent`, `VoiceStatsUserProfileComponent`, `VoiceStatsApi.fetchVoiceStats/fetchVoiceStatsUser`, `ApiBase.getStatic`, timeline `maxValue/getBarHeight`, `getActivityIcon`, FontAwesome in navbar, `backendUrl` injection in active-servers-list, duplicate export in `libs/pages/src/index.ts:5,17`, duplicate `provideZoneChangeDetection()`.

---

## 5. Deployment, CI & tooling

### 5.1 [High] Forwarded headers dropped behind NPM → Caddy → Express *(very likely; verify in prod)*
`deploy/Caddyfile:19-20` has no `trusted_proxies`. Caddy ≥ 2.5 ignores/overwrites `X-Forwarded-*` from untrusted upstreams, so Express (`trust proxy 1`, `api/index.ts:33-36`) sees `X-Forwarded-Proto: http` → `req.secure` false → express-session **won't send the `secure` cookie** (OAuth "succeeds" but the user is never logged in), and `req.ip` = NPM's IP for everyone → all users share 300 req/min (a dashboard load is ~8 calls).

**Fix:** global `servers { trusted_proxies static <NPM IP> }` in the Caddyfile and `trust proxy` = 2 (or an explicit list).

### 5.2 [High] Backups never written *(verify on host)*
`pg-backup.sh:13` does `mkdir -p /var/backups/astolfo` as `postgres` (cron, `server-setup.sh:192-196`); on Debian `/var/backups` is root:root 0755 → `set -e` aborts, no dumps, failure only in unread local mail. Pre-create with `install -d -o postgres -g postgres -m 700` in `server-setup.sh` and alert on failure.

### 5.3 [High] CI deploy pipeline doesn't match the docs
`setup-server.md:139-145` and `deploy.sh:4-6` describe a self-hosted job running `deploy.sh`; none exists. `.github/workflows/image-build.yml` runs `docker compose up -d --build` on `self-hosted` on every push to `main` — which can't work in an unprivileged LXC (`setup-server.md:297`), or, if an old Docker runner is still registered, starts a **second bot with the same token** against a different DB. Replace with checks on `ubuntu-latest` → `deploy/deploy.sh ${{ github.sha }}` on self-hosted.

### 5.4 [Medium] `deploy.sh` robustness
- `:49-52` health check has no retry — bot isn't listening yet right after restart → every healthy deploy reported as failed. Reuse the 20×2s loop from `server-setup.sh:163-171`.
- `:42-47` not atomic: schema pushed before build; build happens in place in `dist/` under running services. A build failure/OOM leaves new schema + broken `dist/apps/bot`; old hashed web chunks vanish under live clients. Build into `releases/<sha>` and swap a symlink.

### 5.5 [Medium] Bot is never linted in CI, and currently fails lint
`bot` has only the inferred `eslint:lint` target; CI runs `-t lint` (`ci.yml:41`). `nx run bot:eslint:lint` currently fails: `create-bar.ts:10` (no-irregular-whitespace), `interaction-utils.ts:89` (no-inferrable-types). Other projects have both `lint` and `eslint:lint`. Unify the target name.

### 5.6 [Medium] Bot tests boot the real bot
`voice-changes.ts:2` / `voice-db.ts:1` import `client` from `src/index.ts`, so importing them runs `main()` (jest output shows `process.exit called with "1"` at `index.ts:55`). With the root `.env` loaded, that can write to the dev DB and attempt `client.login` with the real token. Move the client singleton to `client/instance.ts`.

### 5.7 [Medium] Bot TypeScript isn't strict
`apps/bot/tsconfig*.json` lack `strict`; every lib and the web app have it. E.g. `res.redirect(process.env.CLIENT_URL)` compiles despite `string | undefined`. Enable incrementally.

### 5.8 [Medium] Docker stack hardening (still deployed by `image-build.yml`)
`Dockerfile.bot`/`Dockerfile.web` run as root (no `USER`); `docker-compose.yaml:99` hardcodes Grafana `admin/grafana` on `:3030`; Prometheus open on `:9090`; `:latest` tags. `prometheus.yml` has no `metrics_path` so it scrapes `/metrics` instead of `/api/metrics` (collects nothing). `Dockerfile.bot` runtime stage lacks `openssl` *(plausible Prisma engine failure on alpine)*; `apps/bot/project.json:14-17` lists non-existent `Dockerfile`/`package.json` as inputs.

### 5.9 [Medium] Dependency peer mismatches
`@ngrx/signals` 19.0.0 and `@fortawesome/angular-fontawesome` 1.0.0 peer on `@angular/core ^19` with Angular 21.0.6 installed.

### 5.10 [Low] Tooling / config hygiene
- `.env.example`: `COOKIE_SECRET=SECRET_COOKIE` passes validation if copied to prod; `DEV=true` — any non-empty value (incl. `"false"`) enables the `dev-` slash prefix (`base-slash.ts:20`); `PORT_WEB`, `NODE_ENV`, `CLIENT_URL` missing; `DISCORD_PUBLIC_KEY` unused.
- Unused deps: `@ngx-env/builder`, `vitest`, `@storybook/jest`, `@storybook/testing-library`, `reflect-metadata`, `@angular/animations`, `@angular/forms`, `@angular/platform-browser-dynamic`. `pino-pretty` in both deps and devDeps. Node versions disagree (CI 26, LXC 22, Docker 23 EOL); no `engines`.
- `eslint.config.cjs`: two `@nx/enforce-module-boundaries` blocks (second drops `enforceBuildableLibDependency`/`allow`); no `no-console` rule despite the convention; no OnPush lint rule.
- Stale: `.yarnrc` → missing `yarn-1.22.22.cjs`; `nx.json` `sharedGlobals` lists `ci.yml` twice; `@models/*` path alias → non-existent `libs/models/src`; `codeql.yml` on v2/v3 actions.
- `server-setup.sh:49-51` reads secrets with `read -rp` (echoed) — use `-s`; DB password on the psql command line (`:140`). systemd units lack `NoNewPrivileges`/`ProtectSystem`/`PrivateTmp`.
- Naming: `api/utils.ts/` directory still exists; 18 camelCase files in `apps/bot/src` (including the new `isServerMember.ts`).

---

## 6. Testing

Current: 2 bot spec files (`activeLeaderboard.test.ts`, `leaderboard.test.ts`, 10 tests, passing — but see 5.6). Web/features/libs: 0 specs (web passes via `passWithNoTests`); libs have no `test` targets; Storybook tests not in CI.

Highest-value additions, in order:
1. **Voice session lifecycle** against a mocked `voiceUsers` + deferred `updateMany` — 2.1 and 2.2 reproduce in a few lines and lock in the fixes.
2. **Voice-stats SQL** — at minimum an integration test asserting a deafened session counts once (1.1). Requires `req.db` consistently (1.9).
3. **API handlers via supertest** with mocked `req.db` (locks in DTO shapes).
4. Period/duration helpers in `helpers.ts`; metrics JSON save/restore round-trip.

---

## 7. Status of the previous review

| Item | Status | Notes |
|---|---|---|
| 1.1 Indexes | ✅ Fixed | `schema.prisma:31-36,46,65-66`; migration `20260712144807` |
| 1.2 "Active sessions" metric | ✅ Fixed | `ended_on IS NULL AND type = VOICE` |
| 1.3 `createMany` | ✅ Fixed | joins use `createMany`, closes use one `updateMany` |
| 1.4 Plaintext tokens | 🟡 Partial | `@unique` dropped; still plaintext |
| 2.1 Membership middleware | ✅ Fixed | `isServerMember.ts`; see 1.6 for 403-on-error |
| 2.2 Shared helpers | ✅ Fixed | `helpers.ts` |
| 2.3 Heatmap SQL | ✅ Fixed | but drops open sessions (1.2) |
| 2.4 Batched member fetch | ✅ Fixed | incl. `!guild` case |
| 2.5 Pagination | ✅ Fixed | tie-breaker still missing (1.5) |
| 2.6 Active servers SQL | ✅ Fixed | |
| 2.7 Heatmap timezone | 🟡 Partial | user cells still Node TZ (1.3) |
| 3 Error middleware / 404 / cookies / CORS / rate limit | ✅ Fixed | undermined in prod by 5.1 |
| 3 Env validation | 🟡 Partial | runs late, `CLIENT_URL` missing (1.7) |
| 3 `getStatus` `response.ok` / caching | 🟡 Partial | ok-check done; no caching |
| 4.1 Event errors | 🟡 Partial | catch added; unawaited calls escape (2.8) |
| 4.2 Scheduler leak / shared key | ✅ Fixed | |
| 4.3 Presence per guild | ✅ Fixed | |
| 4.4 Status flush on shutdown | ✅ Fixed | pino flush concern moot (pino 9 `flushSync` on exit) |
| 4.5 `checkForNewGuilds` | 🟡 Partial | `for…of`; prefix defaults still differ |
| 4.6 Status metrics single pass | ✅ Fixed | |
| 4.7 Status cache footprint | ❌ Open | offline members still cached |
| 5.1 O(n²) leaderboards | 🟡 Partial | active/current fixed; inactive/loner not |
| 5.2 Overlap double-deduction | 🟡 Partial | fixed for active; inactive still double-counts (2.7) |
| 5.3 Leaderboards in SQL | ❌ Open | |
| 5.4 Typing gaps | 🟡 Partial | dead `displayName ??` fallback remains |
| 6 Metrics persistence | ✅ Fixed | structured JSON; `save-metrics.ts` stub left |
| 7.1–7.4 Frontend | ✅ Fixed | OnPush not lint-enforced |
| 8 Registry / `Logger.error` / `debug-storybook.log` | ✅ Fixed | |
| 8 `api/utils.ts/` dir, file naming | ❌ Open | |
| 9 Tests | ❌ Open | see §6 |

---

## Suggested order of work

1. **Data correctness (bot + API):** 1.1, 2.3, 2.4 (each a few lines), then 2.1/2.2 with lifecycle tests (§6.1), then 1.2, 2.7.
2. **Prod availability:** 4.1, 5.1, 5.3, 5.2, 5.4 — confirm on the live host which of these are currently biting.
3. **Security:** 2.5, 1.8, 1.6 (`state`, POST logout), 5.8.
4. **Consistency:** 3.1 + 4.3 (pick one timezone convention end-to-end), 3.2 (one schema-sync path).
5. **Hygiene:** 5.5–5.7, 5.9–5.10, frontend dead code, remaining old-review items.
