# Code Review — Optimizations & Improvements

Review date: 2026-07-04 · Branch: `feat/dashboard`

Scope: `apps/bot`, `apps/web`, `libs/`, `features/`, Prisma schema.

---

## 1. Database & Prisma Schema

### 1.1 Redundant / missing indexes (`libs/models/prisma/schema.prisma`)
- `voice_stats`: `@@index([guild_id])` is redundant — it is the leftmost prefix of `@@index([guild_id, member_id])`, `[guild_id, type]`, and `[guild_id, issued_on]`. Dropping it saves write overhead on every voice session insert.
- `message_stats` has **no indexes** besides the PK. Any per-guild or per-user query will do a full table scan on what is likely the fastest-growing table (one row per message). Add `@@index([guild_id, user_id])` and `@@index([guild_id, created_at])`.
- `user_statuses` has no index on `user_id`, so per-user status history queries will scan.

### 1.2 "Active sessions" metric is misleading (`getVoiceStatsOverview.ts:41`)
`COUNT(*) FILTER (WHERE ended_on > NOW() - INTERVAL '5 minutes')` counts sessions that *recently ended*, not currently active ones. Truly active sessions live only in the in-memory `client.voiceUsers` map and are never in the DB. Either rename the field (`recentlyEndedSessions`) or compute the real number from `client.voiceUsers`.

### 1.3 Batch inserts instead of N individual creates
- [voice-db.ts:17-24](apps/bot/src/utils/handlers/vc/voice-db.ts#L17-L24) (`saveAllUserVoiceStatsToDb`) and [set-vc.ts:63-71](apps/bot/src/utils/functions/set-vc.ts#L63-L71) (`saveVc`) issue one `voiceStats.create` per stat inside `Promise.all`. Use `createMany` — one round trip instead of N, and atomic. This matters most on shutdown, where `saveVc` races against the process exiting.

### 1.4 Plaintext OAuth tokens (`user_session` model)
`access_token` / `refresh_token` are stored in plaintext with `@unique` constraints (unique indexes on secrets also put them into index pages). Consider encrypting at rest, and drop the unique constraints — token collisions aren't a real scenario and the indexes are wasted writes.

---

## 2. API — Voice Stats Endpoints (`apps/bot/src/api/routes/features/voice-stats/`)

### 2.1 Extract the duplicated membership check into middleware
All 8 handlers repeat the exact same block:

```ts
const isMember = await req.db.voiceStats.findFirst({
  where: { guild_id: serverId, member_id: req.user?.id ?? '' },
  select: { id: true },
});
if (!isMember) { res.status(403).json({ error: 'Forbidden' }); return; }
```

Extract to an `isServerMember` middleware mounted on `/features/voice-stats/:serverId`. Beyond DRY, the current check has two logic problems:
- A guild member who **never joined a voice channel** gets 403 on their own server's dashboard.
- A user who **left the server** but has old rows keeps access forever.

Checking real membership via `client.guilds.cache.get(serverId)?.members` (cache first, fetch fallback) is both more correct and avoids a DB query per request.

### 2.2 Duplicated helpers across handlers
The same code is copy-pasted in 4–6 files each. Extract shared utilities:
- **Duration math** — `Math.floor(duration / (1000*60*60))` / `% (1000*60*60) / (1000*60)` appears in `getVoiceStatsLeaderboard`, `Overview`, `Channels`, `User`, `Timeline`. One `toDurationParts(ms)` helper.
- **`period` → `startDate` switch** — duplicated in `Leaderboard`, `Timeline`, `Heatmap`, `UserHeatmap` (with subtly different implementations: `now.getTime() - 7*24*…` vs `setDate(now.getDate() - 7)`). One `getStartDateForPeriod(period)`.
- **Channel enrichment** (`getChannelData` / "Unknown Channel" fallback) — duplicated in `Overview`, `Channels`, `User`.

### 2.3 `getVoiceStatsHeatmap` still aggregates in application memory
`getVoiceStatsHeatmap.ts` fetches *all* sessions for the period via `findMany` and reduces them in JS, while the other endpoints (timeline, channels, user-heatmap server side) were already moved to SQL aggregation. Use the same `EXTRACT(HOUR/DOW) … GROUP BY` query that `getVoiceStatsUserHeatmap` already uses — for `period=all` on a big guild this is the difference between a bounded 168-row result and loading the whole table.

Also, the unique-user tracking is accidentally quadratic ([getVoiceStatsHeatmap.ts:90-93](apps/bot/src/api/routes/features/voice-stats/getVoiceStatsHeatmap.ts#L90-L93)): it rebuilds a `Set` from an array on **every session**. If you keep the JS version, store a `Set<string>` in the map value directly.

### 2.4 `getVoiceStatsLeaderboard` — batch the Discord member fetches
[getVoiceStatsLeaderboard.ts:95-128](apps/bot/src/api/routes/features/voice-stats/getVoiceStatsLeaderboard.ts#L95-L128) does one `guild.members.fetch(id)` per leaderboard entry. Use a single batched call: `guild.members.fetch({ user: ids })` — one gateway request instead of up to 100, and far less likely to hit rate limits.

Edge case: when the guild isn't in the cache (`guild === undefined`), `guild?.members.fetch(...)` resolves to `undefined` without throwing, so the catch-based "Unknown User" fallback never runs and `member` is returned as `null` — a different shape than the documented fallback. Handle the `!guild` case explicitly.

### 2.5 `getVoiceStats` — pagination issues
- No `orderBy` on the `findMany` ([getVoiceStats.ts:37-41](apps/bot/src/api/routes/features/voice-stats/getVoiceStats.ts#L37-L41)) — Postgres gives no ordering guarantee, so pages can repeat/skip rows. Add `orderBy: { issued_on: 'desc' }`.
- `count` and `findMany` run sequentially — wrap in `Promise.all`.
- There's a leftover `// TODO: add model-aware filtering` comment.

### 2.6 `getActiveServers` — move aggregation to SQL
[getActiveServers.ts](apps/bot/src/api/routes/features/active-servers/getActiveServers.ts) loads every voice row for the user and reduces in JS. This is exactly the pattern the voice-stats endpoints were refactored away from:

```sql
SELECT guild_id, SUM(EXTRACT(EPOCH FROM (ended_on - issued_on))) AS duration
FROM voice_stats WHERE member_id = $1 AND type = 'VOICE'
GROUP BY guild_id ORDER BY duration DESC
```

It's also the only handler with a manual `try/catch` + `console.error` — everything else relies on `asyncHandler`. Make it consistent (and use `Logger`, not `console`).

### 2.7 Timezone consistency in heatmaps
`getVoiceStatsHeatmap` uses `Date.getHours()` (Node server timezone) while `getVoiceStatsUserHeatmap`'s server aggregation uses `EXTRACT(HOUR FROM issued_on)` (Postgres timezone). If server TZ ≠ DB TZ, the user's cells and the server-average cells are shifted against each other. Pick one (UTC everywhere is simplest) or accept a `tz` query param.

---

## 3. Express Server Setup (`apps/bot/src/api/index.ts`)

- **No global error-handling middleware.** `isAuthenticated` calls `next(new Unauthorized(...))` and `asyncHandler` forwards thrown errors, but there is no `app.use((err, req, res, next) => …)` — Express's default handler returns an HTML stack trace and ignores your `Unauthorized` status. Add a JSON error middleware as the last `app.use`.
- `app.get('*', 404)` only catches **GET** requests; a stray `POST /api/x` falls through. Use `app.use((req, res) => …)`.
- **Session cookie hardening:** no `sameSite` and no `secure` flag. Behind HTTPS in production these should be `sameSite: 'lax'` (at minimum) and `secure: true` with `app.set('trust proxy', 1)`.
- `process.env.COOKIE_SECRET` is passed straight in. Validate required env vars (`DISCORD_BOT_TOKEN`, `COOKIE_SECRET`, `DISCORD_CLIENT_ID/SECRET`, `OWNER`, `DATABASE_URL`) once at startup with a clear error, instead of failing at various depths.
- CORS origins (including a hardcoded LAN IP `192.168.1.16`) belong in an env variable.
- **No rate limiting** on the API — the voice-stats endpoints run multi-aggregate SQL per hit; `express-rate-limit` is cheap insurance.
- `getStatus.ts` proxies `discord.com/api/users/@me` on every call without checking `response.ok` — a 401/429 from Discord is forwarded as a 200 with an error body. Check status, and consider caching the profile briefly (Discord rate-limits this route).

---

## 4. Bot — Event & State Handling

### 4.1 Event errors are unobserved (`base-event.ts`, `base-slash.ts` pattern)
`BaseEvent.run()` calls `this.event(...)` without awaiting or catching. An async event handler rejection becomes a global `unhandledRejection` with no context about which event/guild failed. Wrap in try/catch (or `Promise.resolve(...).catch`) and log with the event name. Same for slash command dispatch in [interaction-create.ts:15](apps/bot/src/events/slashs/interaction-create.ts#L15) — a throwing slash command leaves the interaction hanging ("The application did not respond"); catch and reply with an ephemeral error.

### 4.2 Voice scheduler job leak (`voice-channel.scheduler.ts:33-36`)
`scheduleJob` overwrites the map entry without cancelling an existing job. If a user gets a second job scheduled under the same key (e.g. `setVc` on a reconnect while a job is pending), the old `node-schedule` job is orphaned — it still fires but can no longer be cancelled. Cancel the existing entry before setting a new one.

Also: the job key format here is `` `${guildId}-${userId}` `` while the voice-cache key everywhere else is `` `${guildId}:${memberId}` ``. Discord IDs can't contain `-`, so it works, but export one shared `voiceKey()` (it already exists in [voice-db.ts:5](apps/bot/src/utils/handlers/vc/voice-db.ts#L5)) and use it in `voice-changes.ts`, `set-vc.ts`, and the scheduler.

### 4.3 Presence updates fire once per mutual guild
`presenceUpdate` is emitted per guild the bot shares with the user. `saveStatus` deletes the cache entry on the first event, so the second guild's event logs the "no cached entry" warning every time for multi-guild users — noisy and slightly wasteful. Debounce by comparing the cached status to the new one before saving (the `user_statuses` model is per-user, not per-guild, so one save is correct).

### 4.4 Cached statuses are lost on shutdown (`shutdown-handler.ts`)
`shutdown()` saves metrics and voice stats but never flushes `client.userStatus` — all open status durations are silently dropped on every deploy. Add a `saveStatuses()` step. Also consider `client.destroy()` and closing the HTTP server so in-flight requests finish, and note that the `uncaughtException` handler calls `process.exit(1)` immediately — pino's transport is async, so the log may never flush; `pino.destination({ sync: true })` for fatal paths or `logger.flush()` helps.

### 4.5 `checkForNewGuilds` — unawaited async in `forEach` (`set-config.ts:27`)
`guilds.forEach(async (guild) => …)` fires and forgets; errors are unhandled and the caller can't await completion. Use `for…of` or `Promise.all(map(...))`. Also the in-memory default prefix is `process.env.DEFAULT_PREFIX ?? ','` while the Prisma schema default is `'!'` — the cached config and the DB row can disagree.

### 4.6 `handleStatusMetrics` — four passes over the collection (`status-metrics.ts`)
Four `.filter().size` calls over `client.userStatus`. One loop with a counts object does it in a single pass; for a bot caching every member of every guild this runs on **every presence change**.

### 4.7 `setStatusCache` memory footprint (`set-status.ts`)
Caching a status entry for every member of every guild (including offline ones) makes `client.userStatus` scale with total member count. If the bot grows, consider caching only non-offline users and treating a cache miss as "was offline".

---

## 5. Leaderboard Functions (`apps/bot/src/utils/functions/leaderboard/`)

### 5.1 `getActiveLeaderboard` is O(n²) (`activeLeaderboard.ts:38-83`)
For each VOICE stat it re-filters the *entire* stats array for overlapping muted/deafened stats, and `acc.find` makes accumulation quadratic too. Pre-group stats by `member_id` into a `Map<string, voice_stats[]>` once, and use a `Map` for the accumulator. Same `acc.find` / `members.find` pattern in `currentLeaderboard.ts` — build a `Map` of members by id first.

### 5.2 Overlap deduction can double-count
If a user is simultaneously MUTED and DEAF (very common — deafening also mutes), both intervals are deducted from the same VOICE span, so active time is undercounted and can go negative. Merge the muted/deaf intervals per member before subtracting.

### 5.3 Better: aggregate in SQL
This whole family loads every matching `voice_stats` row into memory per invocation. The dashboard API already does per-guild aggregation in SQL (`getVoiceStatsLeaderboard`) — the bot's `/leaderboard` slash command could reuse the same query instead of maintaining a parallel JS implementation.

### 5.4 Typing gaps (`leaderboard.ts:40-44`)
`getVoiceStatsType` declares `guildId` with no type (implicit `any`). Also `member.displayName ?? member.user.username` — `displayName` is never nullish in discord.js, so the fallback is dead; use `member.displayName` or decide the intended precedence.

---

## 6. Metrics Persistence (`apps/bot/src/api/utils.ts/`)

- **Fragile Prometheus text parsing** ([load-on-start.ts:16-56](apps/bot/src/api/utils.ts/load-on-start.ts#L16-L56)): labels are split on `', '` but prom-client separates labels with `","` *without* a space — any metric with 2+ labels parses wrong. `parseInt(value)` also truncates float samples. The root simplification: you control both sides, so persist a small structured JSON (`{ name, labels, value }[]`) instead of round-tripping through Prometheus text format.
- The `metrics.jsonb` column is `Json` but stores the raw text blob as a string — either store real JSON or make it a `String` column.
- `save-on-exit.ts` is imported for side effects in `api/index.ts` (`import './utils.ts/save-on-exit'`) but exports a plain function and has no side effects — the import is dead; remove it.

---

## 7. Frontend — Angular (`libs/`, `features/`)

### 7.1 Remove debug `console.log`s
- [voice-stats-heatmap.component.ts:70-74](features/voice-stats/ui/src/lib/voice-stats-heatmap/voice-stats-heatmap.component.ts#L70-L74) — five logs inside a `computed()`, so they fire on **every recomputation**, and one dumps the entire backend payload.
- [humanize-duration.pipe.ts:13](libs/common/pipes/src/lib/humanize-duration.pipe.ts#L13) — logs every transformed value; pipes run constantly.

### 7.2 `VoiceStatsApi` — collapse the `string | (() => string)` duplication
Every method repeats the `typeof x === 'function' ? … : …` dance (~10 times in [voice-stats.api.ts](features/voice-stats/data-access/src/lib/voice-stats.api.ts)). Two options:
- A tiny `unwrap<T>(v: T | (() => T)): T` helper used inside the url/query closures, or
- Since `httpResource` re-evaluates the closure anyway, accept **only** the reactive `() => string` form (all current call sites in `detail-overview.component.ts` already pass functions). That halves the file and simplifies every signature.

### 7.3 Heatmap component micro-optimizations
- The tooltip formatter does `data.heatmap.find(...)` on every hover ([voice-stats-heatmap.component.ts:94](features/voice-stats/ui/src/lib/voice-stats-heatmap/voice-stats-heatmap.component.ts#L94)) — you already build `dataMap`; store the full point in it and reuse.
- The 24×7 grid-fill / label arrays are duplicated between `voice-stats-heatmap` and `voice-stats-user-heatmap` components — extract a shared helper.

### 7.4 `ChangeDetectionStrategy.OnPush`
`DetailOverviewComponent` sets `OnPush`, but most feature/ui components (e.g. `VoiceStatsHeatmapComponent`) don't declare it. With signals + `input()` they're all OnPush-safe — add it consistently (or enforce via an ESLint rule).

---

## 8. Code Organization & Hygiene

- **`apps/bot/src/api/utils.ts/` is a *directory* named `utils.ts`** — actively confusing for humans and tooling alike. Rename to `utils/`.
- **Inconsistent file naming:** kebab-case (`get-health.ts`, `save-on-exit.ts`) vs camelCase (`getVoiceStats.ts`, `discordStrategy.ts`, `testCommand.ts`) side by side. Pick one (repo majority is kebab-case) and enforce with a lint rule.
- **Registry loader** ([registry.ts:53-77](apps/bot/src/utils/registry.ts#L53-L77)):
  - `file.endsWith('.ts')` also matches `.d.ts` and would match `*.test.ts` if a test ever lands in a scanned folder — filter those out.
  - After the `isDirectory()` recursion there's no `continue`/`else`, so a directory named e.g. `foo.ts` would also be `import`ed.
  - `new instance.default()` combined with `const { default: instance }` means modules need a double-default export — worth normalizing (`const mod = await import(...); const Ctor = mod.default?.default ?? mod.default;`).
  - `fs.lstat` is awaited per file sequentially; `readdir(dir, { withFileTypes: true })` removes the stat calls entirely.
- **`debug-storybook.log`** sits in the repo root — delete and gitignore.
- `Logger.error` is `async` but no caller awaits it — make it synchronous (the `Response` body-reading branch can be handled differently) so fatal-path logs aren't lost.

---

## 9. Testing

Current coverage is a single spec (`leaderboard.test.ts`). Highest-value additions, in order:
1. **Voice session lifecycle** — join/leave/change-channel/mute against a mocked `client.voiceUsers` map; this is the core data-producing logic and has the most edge cases (double events, shutdown flush).
2. **Voice-stats API handlers** — supertest against the router with a mocked `req.db`; locks in the DTO shapes the Angular models depend on.
3. **`getStartDateForPeriod` / duration helpers** once extracted (§2.2) — trivial to test and used everywhere.
4. **Prometheus parse/restore round-trip** (§6) — currently the easiest thing to silently break.

---

## Suggested priority

| Priority | Items |
|---|---|
| High (correctness) | 2.1 membership check, 3 error middleware + cookie flags, 4.1 event error handling, 4.4 status flush on shutdown, 2.5 missing `orderBy`, 5.2 double-deduction |
| Medium (performance) | 2.3 heatmap SQL aggregation, 2.6 active-servers SQL, 2.4 batched member fetch, 1.3 `createMany`, 5.1 O(n²) leaderboard, 1.1 indexes |
| Low (hygiene) | 2.2 shared helpers, 7.1 console.logs, 7.2 API dedup, 8 naming/`utils.ts` dir, 6 metrics format, 9 tests |
