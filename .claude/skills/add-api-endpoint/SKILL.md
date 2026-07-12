---
name: add-api-endpoint
description: Add a new REST endpoint to the bot's Express API (apps/bot). USE WHEN creating or modifying API routes, voice-stats endpoints, or any /api/features/* handler. Covers handler pattern, auth, SQL aggregation, route registration, and the frontend DTO mirror.
---

# Adding an API Endpoint

The API lives inside the bot app: `apps/bot/src/api/`. Follow the existing handler shape exactly — the voice-stats handlers are the reference implementation.

## Steps

1. **Handler file** — `apps/bot/src/api/routes/features/<feature>/get<Thing>.ts` (camelCase file names in this folder). Skeleton:

```ts
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getThing: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    if (!serverId) {
      res.status(400).send({ error: 'Missing serverId' });
      return;
    }

    // Membership gate (current pattern — every guild-scoped handler has it):
    const isMember = await req.db.voiceStats.findFirst({
      where: { guild_id: serverId, member_id: req.user?.id ?? '' },
      select: { id: true },
    });
    if (!isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // ... query via req.db ...
    res.send({ /* stable DTO shape */ });
  });
```

2. **Export** it from the feature barrel: `apps/bot/src/api/routes/features/<feature>/index.ts`.

3. **Register the route** in `apps/bot/src/api/routes/features/index.ts` — always with `isAuthenticated`:

```ts
router.get('/features/<feature>/:serverId/<path>', isAuthenticated, getThing);
```

4. **Mirror the DTO** in the frontend model: `features/<feature>/data-access/src/lib/*.model.ts`. The frontend types are hand-written mirrors — an unmirrored change is a silent runtime break.

5. **Add the fetch method** to the feature's API class (`features/<feature>/data-access/src/lib/*.api.ts`), extending `ApiBase`. Accept reactive params as `() =>` functions (see `voice-stats.api.ts` for the pattern).

## Rules

- **Aggregate in SQL, not JS.** Use `req.db.$queryRaw` (tagged template — parameters are auto-escaped) or `Prisma.sql` for conditional fragments (`Prisma.empty` for the no-op case). Never fetch all rows and reduce in JS; CODE_REVIEW.md §2.3/§2.6 documents why.
- Durations: stored as `issued_on`/`ended_on` timestamps; compute ms via `SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint`. Raw bigint columns come back as `bigint` — convert with `Number()`.
- Discord enrichment (names/avatars/channels) comes from `client.guilds.cache` (import `client` from `apps/bot/src/index.ts` via relative path). Always handle the cache-miss case ("Unknown Channel" fallback pattern).
- Validate/clamp query params like the existing handlers (`Number.isFinite(raw) && raw > 0 && raw <= 200 ? raw : default`).
- Whitelist any value interpolated into SQL identifiers/keywords (see `VALID_GRANULARITIES` in `getVoiceStatsTimeline.ts`).
- Errors: rely on `asyncHandler` — no per-handler try/catch, no `console.error`.

## Known issues to not copy-paste

CODE_REVIEW.md §2 lists flaws in the existing handlers (membership check semantics, missing `orderBy` on pagination, sequential queries that should be `Promise.all`). Prefer fixing over replicating.
