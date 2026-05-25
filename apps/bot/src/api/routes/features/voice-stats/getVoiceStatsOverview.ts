import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { ChannelType } from 'discord.js';
import { voice_stats } from '@prisma/client';

// Helper to calculate activity breakdown
function calculateActivityBreakdown(sessions: voice_stats[]) {
  const activityMap = new Map<string, { duration: number; sessions: number }>();

  sessions.forEach((session) => {
    const type = session.type || 'voice';
    const duration = session.ended_on.getTime() - session.issued_on.getTime();

    const existing = activityMap.get(type);
    if (existing) {
      existing.duration += duration;
      existing.sessions += 1;
    } else {
      activityMap.set(type, { duration, sessions: 1 });
    }
  });

  const totalDuration = Array.from(activityMap.values()).reduce(
    (sum, v) => sum + v.duration,
    0,
  );

  return Array.from(activityMap.entries()).map(([type, data]) => ({
    type,
    duration: data.duration,
    durationHours: Math.floor(data.duration / (1000 * 60 * 60)),
    durationMinutes: Math.floor(
      (data.duration % (1000 * 60 * 60)) / (1000 * 60),
    ),
    sessionCount: data.sessions,
    percentage:
      totalDuration > 0 ? Math.round((data.duration / totalDuration) * 100) : 0,
  }));
}

export const getVoiceStatsOverview: RequestHandler<
  { serverId: string },
  unknown
> = asyncHandler(async (req, res) => {
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
  const channelStats = voiceSessions.reduce(
    (acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();
      if (!acc[session.channel_id]) {
        acc[session.channel_id] = { duration: 0, sessions: 0 };
      }
      acc[session.channel_id].duration += duration;
      acc[session.channel_id].sessions += 1;
      return acc;
    },
    {} as Record<string, { duration: number; sessions: number }>,
  );

  const mostActiveChannel = Object.entries(channelStats).reduce(
    (max, [channelId, stats]) => {
      if (stats.duration > max.duration) {
        return {
          channelId,
          duration: stats.duration,
          sessions: stats.sessions,
        };
      }
      return max;
    },
    { channelId: '', duration: 0, sessions: 0 },
  );

  // Get current active sessions (sessions with ended_on in the future or very recent)
  const now = new Date();
  const recentThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  const activeSessions = voiceSessions.filter(
    (s) => s.ended_on > recentThreshold,
  ).length;

  // Fetch guild and enrich most active channel
  const guild = client.guilds.cache.get(serverId);
  let mostActiveChannelData = null;

  if (mostActiveChannel.channelId) {
    const channel = guild?.channels.cache.get(mostActiveChannel.channelId);

    if (channel) {
      mostActiveChannelData = {
        id: channel.id,
        name: channel.name,
        type: ChannelType[channel.type],
      };
    } else {
      mostActiveChannelData = {
        id: mostActiveChannel.channelId,
        name: 'Unknown Channel',
        type: 'VOICE',
      };
    }
  }

  // Calculate activity breakdown
  const activityBreakdown = calculateActivityBreakdown(voiceSessions);

  res.send({
    // New structured format
    server: {
      totalDuration,
      totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
      totalDurationMinutes: Math.floor(
        (totalDuration % (1000 * 60 * 60)) / (1000 * 60),
      ),
      totalSessions: voiceSessions.length,
      activeUsers,
      activeSessions,
      mostActiveChannel: mostActiveChannelData,
      mostActiveChannelDuration: mostActiveChannel.duration,
      mostActiveChannelSessions: mostActiveChannel.sessions,
    },
    activityBreakdown,
  });
});
