---
name: db-migration
description: Change the database schema (Prisma + Postgres) — new tables, columns, indexes, migrations. USE WHEN editing schema.prisma or when a feature needs new persistent data.
---

# Database Changes (Prisma)

Single schema file: `libs/models/prisma/schema.prisma`. Postgres. The Prisma client is consumed through the `Db` facade in `apps/bot/src/db/index.ts`.

## Workflow

1. Edit `libs/models/prisma/schema.prisma`.
2. Make sure the dev database is up: `yarn docker:dev:database:up` (compose file `docker-compose.dev.yaml`; this script also runs migrate).
3. Create + apply the migration: `yarn nx run models:prisma-migrate` (prompts for a name).
4. Regenerate the client: `yarn nx run models:prisma-generate`.
5. **Update the `Db` facade**: new models must be added to both the `Db` interface and the `getDb()` object in `apps/bot/src/db/index.ts` (facade key is camelCase, e.g. `voiceStats: currentClient.voice_stats`).
6. Production applies migrations via `yarn prisma:deploy` (`nx run models:prisma-deploy`).

## Conventions

- Tables and columns are **snake_case** (`voice_stats`, `guild_id`, `issued_on`). Exception: the `session` table uses camelCase fields because `@quixo3/prisma-session-store` requires them — don't "fix" it.
- IDs: Discord snowflakes are `String @db.VarChar` (never numeric). Own PKs are `String @id @default(uuid())`.
- Timestamps: `DateTime @db.Timestamp(6)`; naming pattern is `issued_on`/`ended_on` for sessions, `created_at`/`ended_at` for statuses.
- Voice durations are always computed from the two timestamps, never stored.

## Index guidance

Every query path needs index support — `voice_stats` queries are always guild-scoped (`guild_id` leading column), so composite indexes start with `guild_id`. Remember:

- A composite index covers its leftmost prefix — don't add `@@index([a])` next to `@@index([a, b])`.
- `message_stats` currently has **no indexes** and `user_statuses` lacks one on `user_id` (CODE_REVIEW.md §1.1) — if you touch those tables, add them.

## Consumers to keep in sync

- Client caches typed against Prisma models: `apps/bot/src/client/client.ts` (`guild_configs`, `user_configs`, `user_statuses`, `voice_stats`).
- Raw SQL in the voice-stats API handlers (`apps/bot/src/api/routes/features/voice-stats/*`) references column names directly — renames break them silently (no type checking on `$queryRaw` strings).
- Frontend DTO mirrors in `features/*/data-access/**/*.model.ts` if response shapes change downstream.
