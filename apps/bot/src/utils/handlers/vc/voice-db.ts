import { client } from '../../..';
import { Prisma } from '@prisma/client';
import { VOICE_TYPE, voiceKey } from './voice-utils';

/**
 * Closes the given open rows in one update and drops them from the cache by
 * id (never by index, so it's safe against the cache changing meanwhile).
 */
const closeVoiceStats = async (k: string, ids: string[], date: Date) => {
  // ended_on: null — never overwrite an end time that is already set (e.g. a
  // stale cache entry for a row that was closed earlier)
  await client.dataSource.voiceStats.updateMany({
    where: { id: { in: ids }, ended_on: null },
    data: { ended_on: date },
  });

  const remaining = (client.voiceUsers.get(k) ?? []).filter(
    (stat) => !ids.includes(stat.id)
  );
  if (remaining.length > 0) {
    client.voiceUsers.set(k, remaining);
  } else {
    client.voiceUsers.delete(k);
  }
};

export const saveAllUserVoiceStatsToDb = async (
  memberId: string,
  guildId: string,
  date: Date
) => {
  const k = voiceKey(guildId, memberId);
  const voiceUsersStats = client.voiceUsers.get(k) ?? [];

  if (voiceUsersStats.length === 0) return;

  // Rows were inserted open (ended_on = null) on join; closing is one update
  await closeVoiceStats(
    k,
    voiceUsersStats.map((stat) => stat.id),
    date
  );
};

export const saveTypeUserVoiceStats = async (
  memberId: string,
  guildId: string,
  date: Date,
  types: VOICE_TYPE[]
) => {
  const k = voiceKey(guildId, memberId);
  const closing = (client.voiceUsers.get(k) ?? []).filter((stat) =>
    types.includes(stat.type as VOICE_TYPE)
  );

  if (closing.length === 0) return;

  // All ended types (e.g. DEAF + MUTED on undeafen) close in one update
  await closeVoiceStats(
    k,
    closing.map((stat) => stat.id),
    date
  );
};

/**
 * Crash recovery: close sessions left open by an unclean shutdown. The best
 * available guess for when they ended is the last metrics snapshot (written
 * every 30s while the bot was alive); GREATEST guards against a session that
 * opened inside the final 30s window ending before it started.
 */
export const closeDanglingVoiceSessions = async () => {
  const lastAlive = await client.dataSource.metrics.findFirst({
    orderBy: { updated_at: 'desc' },
    select: { updated_at: true },
  });
  const cutoff = lastAlive?.updated_at ?? new Date();

  return client.dataSource.$executeRaw(Prisma.sql`
    UPDATE voice_stats
    SET ended_on = GREATEST(issued_on, ${cutoff})
    WHERE ended_on IS NULL
  `);
};
