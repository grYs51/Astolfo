import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';

export const getActiveServers: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    const { user } = req;
    const { id } = user;

    try {
      // Get all voice stats for the user with type 'VOICE'
      const voiceStats = await req.db.voiceStats.findMany({
        where: {
          member_id: id,
          type: 'VOICE',
        },
        select: {
          guild_id: true,
          issued_on: true,
          ended_on: true,
        },
      });

      // Calculate total duration per guild
      const guildDurations = voiceStats.reduce((acc, stat) => {
        const issuedOn = new Date(stat.issued_on);
        const endedOn = new Date(stat.ended_on);

        if (isNaN(issuedOn.getTime()) || isNaN(endedOn.getTime())) {
          // Handle invalid date
          return acc;
        }

        const duration = (endedOn.getTime() - issuedOn.getTime()) / 1000; // duration in seconds
        if (!acc[stat.guild_id]) {
          acc[stat.guild_id] = 0;
        }
        acc[stat.guild_id] += duration;
        return acc;
      }, {} as Record<string, number>);

      // Convert to array and sort by duration in descending order
      const sortedGuildDurations = Object.entries(guildDurations)
        .map(([guild_id, duration]) => ({ guild_id, duration }))
        .sort((a, b) => b.duration - a.duration);

      // Get guild details from client
      const uniqueServers = sortedGuildDurations.map(
        ({ guild_id, duration }) => {
          const guild = client.guilds.cache.get(guild_id);
          return {
            id: guild_id,
            name: guild?.name,
            icon: guild?.iconURL(),
            totalDuration: duration,
          };
        }
      );

      res.send(uniqueServers);
    } catch (error) {
      res.status(500).send(error);
    }
  }
);
