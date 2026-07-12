import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { GuildMember } from 'discord.js';
import { VoiceStatsLeaderboard, VoiceStatsPeriod } from '@nx-stolfo/api-interfaces';
import { client } from '../../../..';
import { currentClient } from '../../../../db';
import { Prisma } from '@prisma/client';
import { Logger } from '../../../../utils/logger';
import { getStartDateForPeriod, toDurationParts } from '../helpers';

export const getVoiceStatsLeaderboard: RequestHandler<{ serverId: string }, VoiceStatsLeaderboard> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 10;

    // Time period filter (optional): 'day', 'week', 'month', 'all'
    const rawPeriod = req.query.period as string | undefined;
    const period: VoiceStatsPeriod =
      rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'month' ? rawPeriod : 'all';
    const startDate = getStartDateForPeriod(period);

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
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS total_duration,
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
      const parts = toDurationParts(totalDuration);
      return {
        memberId: row.member_id,
        totalDuration,
        totalDurationHours: parts.hours,
        totalDurationMinutes: parts.minutes,
        sessionCount,
        uniqueChannels: Number(row.unique_channels),
        averageSessionDuration: sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0,
      };
    });

    // One batched gateway request for all leaderboard entries instead of
    // one fetch per member; missing guild/members fall back to "Unknown User".
    const guild = client.guilds.cache.get(serverId);
    const membersById = new Map<string, GuildMember>();
    if (guild && leaderboard.length > 0) {
      try {
        const fetched = await guild.members.fetch({
          user: leaderboard.map((entry) => entry.memberId),
        });
        fetched.forEach((member) => membersById.set(member.id, member));
      } catch (error) {
        Logger.warn(`Failed to batch-fetch members for guild ${serverId}`, error);
      }
    }

    const enrichedLeaderboard = leaderboard.map((entry) => {
      const guildMember = membersById.get(entry.memberId);
      const member = guildMember
        ? {
            id: guildMember.id,
            username: guildMember.user.username,
            displayName: guildMember.displayName,
            avatar: guildMember.user.displayAvatarURL(),
          }
        : {
            id: entry.memberId,
            username: 'Unknown User',
            displayName: null,
            avatar: null,
          };

      return {
        member,
        totalDuration: entry.totalDuration,
        totalDurationHours: entry.totalDurationHours,
        totalDurationMinutes: entry.totalDurationMinutes,
        sessionCount: entry.sessionCount,
        uniqueChannels: entry.uniqueChannels,
        averageSessionDuration: entry.averageSessionDuration,
      };
    });

    res.send({
      leaderboard: enrichedLeaderboard,
      period,
      total: enrichedLeaderboard.length,
    });
  });
