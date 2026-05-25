import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { ChannelType } from 'discord.js';

type ChannelAggRow = {
  channel_id: string;
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
};

export const getVoiceStatsChannels: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
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
      const discordChannel = guild?.channels.cache.get(row.channel_id);

      const channel = discordChannel
        ? { id: discordChannel.id, name: discordChannel.name, type: ChannelType[discordChannel.type] }
        : { id: row.channel_id, name: 'Unknown Channel', type: 'VOICE' };

      return {
        channel,
        totalDuration,
        totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
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
