import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStatsUser: RequestHandler<{ serverId: string; userId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { serverId, userId } = req.params;

    if (!user || !user.id) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!serverId || !userId) {
      res.status(400).send({ error: 'Missing serverId or userId' });
      return;
    }

    // Fetch voice sessions for the specific user in the server
    const userSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
        member_id: userId,
      },
      orderBy: {
        issued_on: 'desc',
      },
    });

    if (userSessions.length === 0) {
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

    // Calculate total duration
    const totalDuration = userSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      return acc + duration;
    }, 0);

    // Aggregate by channel to find favorite and breakdown
    const channelStats = userSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();

      if (!acc[session.channel_id]) {
        acc[session.channel_id] = {
          channelId: session.channel_id,
          duration: 0,
          sessions: 0,
          channelType: session.type,
        };
      }

      acc[session.channel_id].duration += duration;
      acc[session.channel_id].sessions += 1;

      return acc;
    }, {} as Record<string, { channelId: string; duration: number; sessions: number; channelType: string }>);

    // Find favorite channel (most time spent)
    const favoriteChannel = Object.values(channelStats).reduce(
      (max, stat) => (stat.duration > max.duration ? stat : max),
      { channelId: '', duration: 0, sessions: 0, channelType: '' }
    );

    // Format channel breakdown
    const channelBreakdown = Object.values(channelStats)
      .map((stat) => ({
        channelId: stat.channelId,
        channelType: stat.channelType,
        totalDuration: stat.duration,
        totalDurationHours: Math.floor(stat.duration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((stat.duration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount: stat.sessions,
        percentage: Math.round((stat.duration / totalDuration) * 100),
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    // Get recent sessions (last 10)
    const recentSessions = userSessions.slice(0, 10).map((session) => ({
      id: session.id,
      channelId: session.channel_id,
      channelType: session.type,
      issuedOn: session.issued_on,
      endedOn: session.ended_on,
      duration: session.ended_on.getTime() - session.issued_on.getTime(),
      durationMinutes: Math.floor((session.ended_on.getTime() - session.issued_on.getTime()) / (1000 * 60)),
    }));

    res.send({
      userId,
      totalDuration,
      totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
      totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
      sessionCount: userSessions.length,
      uniqueChannels: Object.keys(channelStats).length,
      favoriteChannel: favoriteChannel.channelId || null,
      favoriteChannelDuration: favoriteChannel.duration,
      averageSessionDuration: Math.floor(totalDuration / userSessions.length),
      averageSessionDurationMinutes: Math.floor(totalDuration / userSessions.length / (1000 * 60)),
      recentSessions,
      channelBreakdown,
    });
  });
