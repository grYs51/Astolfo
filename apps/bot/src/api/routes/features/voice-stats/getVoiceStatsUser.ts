import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { getChannelData, toDurationParts } from '../helpers';

type UserTotalsRow = { total_duration: bigint; session_count: bigint };
type UserChannelRow = { channel_id: string; total_duration: bigint; session_count: bigint };

export const getVoiceStatsUser: RequestHandler<{ serverId: string; userId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;

    if (!userId) {
      res.status(400).send({ error: 'Missing userId' });
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

    const channelBreakdown = channelRows.map((row) => {
      const duration = Number(row.total_duration);
      const parts = toDurationParts(duration);
      return {
        channel: getChannelData(guild, row.channel_id),
        totalDuration: duration,
        totalDurationHours: parts.hours,
        totalDurationMinutes: parts.minutes,
        sessionCount: Number(row.session_count),
        percentage: totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0,
      };
    });

    const favoriteRow = channelRows[0];
    const favoriteChannelData = favoriteRow ? getChannelData(guild, favoriteRow.channel_id) : null;

    const enrichedRecentSessions = recentSessions.map((session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      return {
        id: session.id,
        channel: getChannelData(guild, session.channel_id),
        issuedOn: session.issued_on,
        endedOn: session.ended_on,
        duration,
        durationMinutes: Math.floor(duration / (1000 * 60)),
      };
    });

    const totalParts = toDurationParts(totalDuration);

    res.send({
      userId,
      totalDuration,
      totalDurationHours: totalParts.hours,
      totalDurationMinutes: totalParts.minutes,
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
