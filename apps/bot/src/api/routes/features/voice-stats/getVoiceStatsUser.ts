import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { ChannelType } from 'discord.js';

type UserTotalsRow = { total_duration: bigint; session_count: bigint };
type UserChannelRow = { channel_id: string; total_duration: bigint; session_count: bigint };

export const getVoiceStatsUser: RequestHandler<{ serverId: string; userId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;

    if (!serverId || !userId) {
      res.status(400).send({ error: 'Missing serverId or userId' });
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

    // Run all three queries in parallel: totals, channel breakdown, recent sessions
    const [totalsResult, channelRows, recentSessions] = await Promise.all([
      req.db.$queryRaw<UserTotalsRow[]>`
        SELECT
          COALESCE(SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint, 0) AS total_duration,
          COUNT(*)::bigint AS session_count
        FROM voice_stats
        WHERE guild_id = ${serverId} AND member_id = ${userId}
      `,
      req.db.$queryRaw<UserChannelRow[]>`
        SELECT
          channel_id,
          SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS total_duration,
          COUNT(*)::bigint AS session_count
        FROM voice_stats
        WHERE guild_id = ${serverId} AND member_id = ${userId}
        GROUP BY channel_id
        ORDER BY total_duration DESC
      `,
      req.db.voiceStats.findMany({
        where: { guild_id: serverId, member_id: userId },
        orderBy: { issued_on: 'desc' },
        take: 10,
      }),
    ]);

    const [totals] = totalsResult;
    const totalDuration = Number(totals.total_duration);
    const sessionCount = Number(totals.session_count);

    if (sessionCount === 0) {
      res.send({
        userId,
        totalDuration: 0,
        totalDurationHours: 0,
        totalDurationMinutes: 0,
        sessionCount: 0,
        uniqueChannels: 0,
        favoriteChannel: null,
        averageSessionDuration: 0,
        recentSessions: [],
        channelBreakdown: [],
      });
      return;
    }

    const guild = client.guilds.cache.get(serverId);
    const getChannelData = (channelId: string) => {
      const channel = guild?.channels.cache.get(channelId);
      return channel
        ? { id: channel.id, name: channel.name, type: ChannelType[channel.type] }
        : { id: channelId, name: 'Unknown Channel', type: 'VOICE' };
    };

    const channelBreakdown = channelRows.map((row) => {
      const duration = Number(row.total_duration);
      return {
        channel: getChannelData(row.channel_id),
        totalDuration: duration,
        totalDurationHours: Math.floor(duration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount: Number(row.session_count),
        percentage: totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0,
      };
    });

    const favoriteRow = channelRows[0];
    const favoriteChannelData = favoriteRow ? getChannelData(favoriteRow.channel_id) : null;

    const enrichedRecentSessions = recentSessions.map((session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      return {
        id: session.id,
        channel: getChannelData(session.channel_id),
        issuedOn: session.issued_on,
        endedOn: session.ended_on,
        duration,
        durationMinutes: Math.floor(duration / (1000 * 60)),
      };
    });

    res.send({
      userId,
      totalDuration,
      totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
      totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
      sessionCount,
      uniqueChannels: channelRows.length,
      favoriteChannel: favoriteChannelData,
      favoriteChannelDuration: favoriteRow ? Number(favoriteRow.total_duration) : 0,
      averageSessionDuration: Math.floor(totalDuration / sessionCount),
      averageSessionDurationMinutes: Math.floor(totalDuration / sessionCount / (1000 * 60)),
      recentSessions: enrichedRecentSessions,
      channelBreakdown,
    });
  });
