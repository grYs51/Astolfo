import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { ChannelType } from 'discord.js';

type TotalsRow = {
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
  active_sessions: bigint;
};
type ChannelRow = { channel_id: string; total_duration: bigint; session_count: bigint };
type TypeRow = { type: string; duration: bigint; session_count: bigint };

export const getVoiceStatsOverview: RequestHandler<
  { serverId: string },
  unknown
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;

  if (!serverId) {
    res.status(400).send({ error: 'Missing serverId' });
    return;
  }

  const isMember = await req.db.voiceStats.findFirst({
    where: { guild_id: serverId, member_id: req.user?.id ?? '' },
    select: { id: true },
  });
  if (!isMember) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Server totals + active sessions in a single SQL query
  const [totals] = await req.db.$queryRaw<TotalsRow[]>`
    SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint, 0) AS total_duration,
      COUNT(*)::bigint AS session_count,
      COUNT(DISTINCT member_id)::bigint AS unique_users,
      COUNT(*) FILTER (WHERE ended_on > NOW() - INTERVAL '5 minutes')::bigint AS active_sessions
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
    return {
      type: r.type,
      duration,
      durationHours: Math.floor(duration / (1000 * 60 * 60)),
      durationMinutes: Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60)),
      sessionCount: Number(r.session_count),
      percentage: totalTypesDuration > 0 ? Math.round((duration / totalTypesDuration) * 100) : 0,
    };
  });

  // Enrich most active channel with Discord metadata
  const guild = client.guilds.cache.get(serverId);
  let mostActiveChannelData = null;
  if (topChannel) {
    const discordChannel = guild?.channels.cache.get(topChannel.channel_id);
    mostActiveChannelData = discordChannel
      ? { id: discordChannel.id, name: discordChannel.name, type: ChannelType[discordChannel.type] }
      : { id: topChannel.channel_id, name: 'Unknown Channel', type: 'VOICE' };
  }

  res.send({
    server: {
      totalDuration,
      totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
      totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
      totalSessions: Number(totals.session_count),
      activeUsers: Number(totals.unique_users),
      activeSessions: Number(totals.active_sessions),
      mostActiveChannel: mostActiveChannelData,
      mostActiveChannelDuration: topChannel ? Number(topChannel.total_duration) : 0,
      mostActiveChannelSessions: topChannel ? Number(topChannel.session_count) : 0,
    },
    activityBreakdown,
  });
});
