import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStatsLeaderboard: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { serverId } = req.params;

    if (!user || !user.id) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!serverId) {
      res.status(400).send({ error: 'Missing serverId' });
      return;
    }

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 10;

    // Time period filter (optional)
    const period = req.query.period as string | undefined; // 'day', 'week', 'month', 'all'
    let startDate: Date | undefined;

    const now = new Date();
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = undefined;
    }

    // Fetch voice sessions
    const voiceSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
        ...(startDate && { issued_on: { gte: startDate } }),
      },
    });

    // Aggregate by user
    const userStats = voiceSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();

      if (!acc[session.member_id]) {
        acc[session.member_id] = {
          memberId: session.member_id,
          totalDuration: 0,
          sessionCount: 0,
          channels: new Set<string>(),
        };
      }

      acc[session.member_id].totalDuration += duration;
      acc[session.member_id].sessionCount += 1;
      acc[session.member_id].channels.add(session.channel_id);

      return acc;
    }, {} as Record<string, { memberId: string; totalDuration: number; sessionCount: number; channels: Set<string> }>);

    // Sort by total duration and take top N
    const leaderboard = Object.values(userStats)
      .map((stat) => ({
        memberId: stat.memberId,
        totalDuration: stat.totalDuration,
        totalDurationHours: Math.floor(stat.totalDuration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((stat.totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount: stat.sessionCount,
        uniqueChannels: stat.channels.size,
        averageSessionDuration: Math.floor(stat.totalDuration / stat.sessionCount),
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, limit);

    res.send({
      leaderboard,
      period: period || 'all',
      total: leaderboard.length,
    });
  });
