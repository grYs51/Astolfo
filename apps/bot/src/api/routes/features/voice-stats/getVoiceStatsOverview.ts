import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStatsOverview: RequestHandler<{ serverId: string }, unknown> =
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

    // Get total voice time for the server
    const voiceSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
      },
    });

    // Calculate total duration in milliseconds
    const totalDuration = voiceSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      return acc + duration;
    }, 0);

    // Get unique active users
    const activeUsers = new Set(voiceSessions.map((s) => s.member_id)).size;

    // Calculate most active channel
    const channelStats = voiceSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      if (!acc[session.channel_id]) {
        acc[session.channel_id] = { duration: 0, sessions: 0 };
      }
      acc[session.channel_id].duration += duration;
      acc[session.channel_id].sessions += 1;
      return acc;
    }, {} as Record<string, { duration: number; sessions: number }>);

    const mostActiveChannel = Object.entries(channelStats).reduce(
      (max, [channelId, stats]) => {
        if (stats.duration > max.duration) {
          return { channelId, duration: stats.duration, sessions: stats.sessions };
        }
        return max;
      },
      { channelId: '', duration: 0, sessions: 0 }
    );

    // Get current active sessions (sessions with ended_on in the future or very recent)
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
    const activeSessions = voiceSessions.filter(
      (s) => s.ended_on > recentThreshold
    ).length;

    res.send({
      totalDuration, // in milliseconds
      totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
      totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
      activeUsers,
      totalSessions: voiceSessions.length,
      mostActiveChannel: mostActiveChannel.channelId || null,
      mostActiveChannelDuration: mostActiveChannel.duration,
      mostActiveChannelSessions: mostActiveChannel.sessions,
      activeSessions,
    });
  });
