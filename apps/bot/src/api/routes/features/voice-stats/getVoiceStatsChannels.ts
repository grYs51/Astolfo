import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { getChannelData, toDurationParts } from '../helpers';

type ChannelAggRow = {
  channel_id: string;
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
};

export const getVoiceStatsChannels: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Aggregate channel stats via SQL — no full table scan into memory
    const channelRows = await req.db.$queryRaw<ChannelAggRow[]>`
      SELECT
        channel_id,
        SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS total_duration,
        COUNT(*)::bigint AS session_count,
        COUNT(DISTINCT member_id)::bigint AS unique_users
      FROM voice_stats
      WHERE guild_id = ${serverId}
      GROUP BY channel_id
      ORDER BY total_duration DESC
    `;

    const guild = client.guilds.cache.get(serverId);

    const enrichedChannels = channelRows.map((row) => {
      const totalDuration = Number(row.total_duration);
      const sessionCount = Number(row.session_count);
      const parts = toDurationParts(totalDuration);

      return {
        channel: getChannelData(guild, row.channel_id),
        totalDuration,
        totalDurationHours: parts.hours,
        totalDurationMinutes: parts.minutes,
        sessionCount,
        uniqueUsers: Number(row.unique_users),
        averageSessionDuration: sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0,
        averageSessionDurationMinutes: sessionCount > 0 ? Math.floor(totalDuration / sessionCount / (1000 * 60)) : 0,
      };
    });

    res.send({
      channels: enrichedChannels,
      total: enrichedChannels.length,
    });
  });
