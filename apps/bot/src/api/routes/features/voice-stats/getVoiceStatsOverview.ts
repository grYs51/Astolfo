import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { getChannelData, toDurationParts } from '../helpers';

type TotalsRow = {
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
};
type ChannelRow = { channel_id: string; total_duration: bigint; session_count: bigint };
type TypeRow = { type: string; duration: bigint; session_count: bigint };

/** Sessions currently open live only in the in-memory voice cache. */
const countActiveSessions = (serverId: string) => {
  let active = 0;
  for (const [key, stats] of client.voiceUsers) {
    if (!key.startsWith(`${serverId}:`)) continue;
    active += stats.filter((s) => s.type === VOICE_TYPE.VOICE).length;
  }
  return active;
};

export const getVoiceStatsOverview: RequestHandler<
  { serverId: string },
  unknown
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;

  // Server totals in a single SQL query
  const [totals] = await req.db.$queryRaw<TotalsRow[]>`
    SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint, 0) AS total_duration,
      COUNT(*)::bigint AS session_count,
      COUNT(DISTINCT member_id)::bigint AS unique_users
    FROM voice_stats
    WHERE guild_id = ${serverId}
  `;

  // Most active channel by cumulative duration
  const [topChannel] = await req.db.$queryRaw<ChannelRow[]>`
    SELECT
      channel_id,
      SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS total_duration,
      COUNT(*)::bigint AS session_count
    FROM voice_stats
    WHERE guild_id = ${serverId}
    GROUP BY channel_id
    ORDER BY total_duration DESC
    LIMIT 1
  `;

  // Activity breakdown grouped by type
  const typeRows = await req.db.$queryRaw<TypeRow[]>`
    SELECT
      type,
      SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS duration,
      COUNT(*)::bigint AS session_count
    FROM voice_stats
    WHERE guild_id = ${serverId}
    GROUP BY type
  `;

  const totalDuration = Number(totals.total_duration);
  const totalTypesDuration = typeRows.reduce((sum, r) => sum + Number(r.duration), 0);

  const activityBreakdown = typeRows.map((r) => {
    const duration = Number(r.duration);
    const parts = toDurationParts(duration);
    return {
      type: r.type,
      duration,
      durationHours: parts.hours,
      durationMinutes: parts.minutes,
      sessionCount: Number(r.session_count),
      percentage: totalTypesDuration > 0 ? Math.round((duration / totalTypesDuration) * 100) : 0,
    };
  });

  // Enrich most active channel with Discord metadata
  const guild = client.guilds.cache.get(serverId);
  const mostActiveChannelData = topChannel
    ? getChannelData(guild, topChannel.channel_id)
    : null;

  const totalParts = toDurationParts(totalDuration);

  res.send({
    server: {
      totalDuration,
      totalDurationHours: totalParts.hours,
      totalDurationMinutes: totalParts.minutes,
      totalSessions: Number(totals.session_count),
      activeUsers: Number(totals.unique_users),
      // Truly active sessions exist only in memory, never in the DB
      activeSessions: countActiveSessions(serverId),
      mostActiveChannel: mostActiveChannelData,
      mostActiveChannelDuration: topChannel ? Number(topChannel.total_duration) : 0,
      mostActiveChannelSessions: topChannel ? Number(topChannel.session_count) : 0,
    },
    activityBreakdown,
  });
});
