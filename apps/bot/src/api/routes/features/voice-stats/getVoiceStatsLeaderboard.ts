import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';
import { currentClient } from '../../../../db';
import { Prisma } from '@prisma/client';

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

    // Aggregate per-user duration and session counts directly in the database
    // to avoid fetching thousands of rows into application memory.
    type LeaderboardRow = {
      member_id: string;
      total_duration: bigint;
      session_count: bigint;
      unique_channels: bigint;
    };

    const dateFilter = startDate
      ? Prisma.sql`AND issued_on >= ${startDate}`
      : Prisma.empty;

    const leaderboardRaw = await currentClient.$queryRaw<LeaderboardRow[]>(
      Prisma.sql`
        SELECT
          member_id,
          SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS total_duration,
          COUNT(*)::bigint AS session_count,
          COUNT(DISTINCT channel_id)::bigint AS unique_channels
        FROM voice_stats
        WHERE guild_id = ${serverId}
        ${dateFilter}
        GROUP BY member_id
        ORDER BY total_duration DESC
        LIMIT ${limit}
      `
    );

    const leaderboard = leaderboardRaw.map((row) => {
      const totalDuration = Number(row.total_duration);
      const sessionCount = Number(row.session_count);
      return {
        memberId: row.member_id,
        totalDuration,
        totalDurationHours: Math.floor(totalDuration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount,
        uniqueChannels: Number(row.unique_channels),
        averageSessionDuration: sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0,
      };
    });

    // Fetch guild and member data from Discord
    const guild = client.guilds.cache.get(serverId);

    // Enrich with Discord member data
    const enrichedLeaderboard = await Promise.all(
      leaderboard.map(async (entry) => {
        let member = null;
        try {
          const guildMember = await guild?.members.fetch(entry.memberId);
          if (guildMember) {
            member = {
              id: guildMember.id,
              username: guildMember.user.username,
              displayName: guildMember.displayName,
              avatar: guildMember.user.displayAvatarURL(),
            };
          }
        } catch (_) {
          // Member not found or left server
          member = {
            id: entry.memberId,
            username: 'Unknown User',
            displayName: null,
            avatar: null,
          };
        }

        return {
          member,
          totalDuration: entry.totalDuration,
          totalDurationHours: entry.totalDurationHours,
          totalDurationMinutes: entry.totalDurationMinutes,
          sessionCount: entry.sessionCount,
          uniqueChannels: entry.uniqueChannels,
          averageSessionDuration: entry.averageSessionDuration,
        };
      })
    );

    res.send({
      leaderboard: enrichedLeaderboard,
      period: period || 'all',
      total: enrichedLeaderboard.length,
    });
  });
