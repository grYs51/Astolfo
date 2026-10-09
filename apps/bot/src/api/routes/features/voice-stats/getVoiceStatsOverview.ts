import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import {
  VoiceActivityType,
  VoiceStatsOverview,
} from '@nx-stolfo/api-interfaces';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { getChannelData, toDurationParts } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';

type TotalsRow = {
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
  active_sessions: bigint;
};
type ChannelRow = {
  channel_id: string;
  total_duration: bigint;
  session_count: bigint;
};
type TypeRow = {
  type: VoiceActivityType;
  duration: bigint;
  session_count: bigint;
};

export const getVoiceStatsOverview: RequestHandler<
  { serverId: string },
  VoiceStatsOverview
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;

  // The three aggregates are independent, so they run in parallel.
  const [[totals], [topChannel], typeRows] = await Promise.all([
    // Server totals in a single SQL query. Only VOICE rows count: MUTED/DEAF/...
    // rows overlap their VOICE row and would double-count time. Open sessions
    // (ended_on IS NULL) count their live duration via COALESCE.
    req.db.$queryRaw<TotalsRow[]>`
    SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint, 0) AS total_duration,
      COUNT(*)::bigint AS session_count,
      COUNT(DISTINCT member_id)::bigint AS unique_users,
      COUNT(*) FILTER (WHERE ended_on IS NULL)::bigint AS active_sessions
    FROM voice_stats
    WHERE guild_id = ${serverId}
      AND type = ${VOICE_TYPE.VOICE}
  `,

    // Most active channel by cumulative duration
    req.db.$queryRaw<ChannelRow[]>`
    SELECT
      channel_id,
      SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS total_duration,
      COUNT(*)::bigint AS session_count
    FROM voice_stats
    WHERE guild_id = ${serverId}
      AND type = ${VOICE_TYPE.VOICE}
    GROUP BY channel_id
    ORDER BY total_duration DESC
    LIMIT 1
  `,

    // Activity breakdown grouped by type
    req.db.$queryRaw<TypeRow[]>`
    SELECT
      type,
      SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS duration,
      COUNT(*)::bigint AS session_count
    FROM voice_stats
    WHERE guild_id = ${serverId}
    GROUP BY type
  `,
  ]);

  const totalDuration = Number(totals.total_duration);
  const totalTypesDuration = typeRows.reduce(
    (sum, r) => sum + Number(r.duration),
    0,
  );

  const activityBreakdown = typeRows.map((r) => {
    const duration = Number(r.duration);
    const parts = toDurationParts(duration);
    return {
      type: r.type,
      duration,
      durationHours: parts.hours,
      durationMinutes: parts.minutes,
      sessionCount: Number(r.session_count),
      percentage:
        totalTypesDuration > 0
          ? Math.round((duration / totalTypesDuration) * 100)
          : 0,
    };
  });

  // Enrich most active channel with Discord metadata
  const mostActiveChannelData = topChannel
    ? getChannelData(serverId, topChannel.channel_id)
    : null;

  const totalParts = toDurationParts(totalDuration);

  const guild = discordDirectory().guild(serverId);

  res.send({
    guild: { id: serverId, name: guild?.name ?? null, icon: guild?.icon ?? null },
    server: {
      totalDuration,
      totalDurationHours: totalParts.hours,
      totalDurationMinutes: totalParts.minutes,
      totalSessions: Number(totals.session_count),
      activeUsers: Number(totals.unique_users),
      activeSessions: Number(totals.active_sessions),
      mostActiveChannel: mostActiveChannelData,
      mostActiveChannelDuration: topChannel
        ? Number(topChannel.total_duration)
        : 0,
      mostActiveChannelSessions: topChannel
        ? Number(topChannel.session_count)
        : 0,
    },
    activityBreakdown,
  });
});
