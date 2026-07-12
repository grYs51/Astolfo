import { client } from '../../..';
import { Prisma } from '@prisma/client';
import { VOICE_TYPE, voiceKey } from './voice-utils';

export const saveAllUserVoiceStatsToDb = async (
  memberId: string,
  guildId: string,
  date: Date
) => {
  const k = voiceKey(guildId, memberId);
  const voiceUsersStats = client.voiceUsers.get(k) ?? [];

  if (voiceUsersStats.length === 0) return;

  // Rows were inserted open (ended_on = null) on join; closing is one update
  await client.dataSource.voiceStats.updateMany({
    where: { id: { in: voiceUsersStats.map((stat) => stat.id) } },
    data: { ended_on: date },
  });
  client.voiceUsers.delete(k);
};

export const saveTypeUserVoiceStats = async (
  memberId: string,
  guildId: string,
  date: Date,
  type: VOICE_TYPE
) => {
  const k = voiceKey(guildId, memberId);
  const stats = client.voiceUsers.get(k);

  if (!stats) return;

  const idx = stats.findIndex((v) => v.type === type);
  if (idx === -1) return;

  const voiceUser = stats[idx];

  // updateMany instead of update: a missing row (open insert failed) is a
  // no-op rather than a thrown P2025
  await client.dataSource.voiceStats.updateMany({
    where: { id: voiceUser.id },
    data: { ended_on: date },
  });

  stats.splice(idx, 1);
  if (stats.length === 0) {
    client.voiceUsers.delete(k);
  }
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
