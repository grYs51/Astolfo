import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { ChannelType } from 'discord.js';

export const getVoiceStatsChannels: RequestHandler<{ serverId: string }, unknown> =
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

    // Fetch voice sessions for the server
    const voiceSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
      },
    });

    // Aggregate by channel
    const channelStats = voiceSessions.reduce((acc, session) => {
      const duration = session.ended_on.getTime() - session.issued_on.getTime();

      if (!acc[session.channel_id]) {
        acc[session.channel_id] = {
          channelId: session.channel_id,
          totalDuration: 0,
          sessionCount: 0,
          uniqueUsers: new Set<string>(),
          peakOccupancy: 0,
          channelType: session.type,
        };
      }

      acc[session.channel_id].totalDuration += duration;
      acc[session.channel_id].sessionCount += 1;
      acc[session.channel_id].uniqueUsers.add(session.member_id);

      return acc;
    }, {} as Record<string, {
      channelId: string;
      totalDuration: number;
      sessionCount: number;
      uniqueUsers: Set<string>;
      peakOccupancy: number;
      channelType: string;
    }>);

    // Calculate average session duration and format response
    const channels = Object.values(channelStats)
      .map((stat) => ({
        channelId: stat.channelId,
        channelType: stat.channelType,
        totalDuration: stat.totalDuration,
        totalDurationHours: Math.floor(stat.totalDuration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((stat.totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount: stat.sessionCount,
        uniqueUsers: stat.uniqueUsers.size,
        averageSessionDuration: Math.floor(stat.totalDuration / stat.sessionCount),
        averageSessionDurationMinutes: Math.floor(stat.totalDuration / stat.sessionCount / (1000 * 60)),
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);

    // Fetch guild and enrich with channel data
    const guild = client.guilds.cache.get(serverId);

    const enrichedChannels = channels.map((channelStat) => {
      const channel = guild?.channels.cache.get(channelStat.channelId);

      let channelData = {
        id: channelStat.channelId,
        name: 'Unknown Channel',
        type: channelStat.channelType,
      };

      if (channel) {
        channelData = {
          id: channel.id,
          name: channel.name,
          type: ChannelType[channel.type],
        };
      }

      return {
        channel: channelData,
        totalDuration: channelStat.totalDuration,
        totalDurationHours: channelStat.totalDurationHours,
        totalDurationMinutes: channelStat.totalDurationMinutes,
        sessionCount: channelStat.sessionCount,
        uniqueUsers: channelStat.uniqueUsers,
        averageSessionDuration: channelStat.averageSessionDuration,
        averageSessionDurationMinutes: channelStat.averageSessionDurationMinutes,
      };
    });

    res.send({
      channels: enrichedChannels,
      total: enrichedChannels.length,
    });
  });
