import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { VoiceActivityType, VoiceStatsUser } from '@nx-stolfo/api-interfaces';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { Prisma } from '@prisma/client';
import {
  getChannelData,
  getStartDateForPeriod,
  memberOrUnknown,
  parsePeriod,
  periodFilter,
  previousPeriodFilter,
  toDurationParts,
} from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';

type UserTotalsRow = { total_duration: bigint; session_count: bigint };
type UserChannelRow = { channel_id: string; total_duration: bigint; session_count: bigint };

export const getVoiceStatsUser: RequestHandler<
  { serverId: string; userId: string },
  VoiceStatsUser | { error: string }
> = asyncHandler(async (req, res) => {
    const { serverId, userId } = req.params;
    const period = parsePeriod(req.query.period, ['week', 'month', 'year', 'all'], 'all');
    const dateFilter = periodFilter(period);
    const previousFilter = previousPeriodFilter(period);
    const start = getStartDateForPeriod(period);

    if (!userId) {
      res.status(400).send({ error: 'Missing userId' });
      return;
    }

    // Independent queries, run in parallel
    const [
      totalsResult,
      channelRows,
      recentSessions,
      previousRows,
      companionRows,
      messageChannelRows,
      previousMessageRows,
    ] = await Promise.all([
      req.db.$queryRaw<UserTotalsRow[]>`
        SELECT
          COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint, 0) AS total_duration,
          COUNT(*)::bigint AS session_count
        FROM voice_stats
        WHERE guild_id = ${serverId} AND member_id = ${userId}
          AND type = ${VOICE_TYPE.VOICE}
          ${dateFilter}
      `,
      req.db.$queryRaw<UserChannelRow[]>`
        SELECT
          channel_id,
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS total_duration,
          COUNT(*)::bigint AS session_count
        FROM voice_stats
        WHERE guild_id = ${serverId} AND member_id = ${userId}
          AND type = ${VOICE_TYPE.VOICE}
          ${dateFilter}
        GROUP BY channel_id
        ORDER BY total_duration DESC
      `,
      req.db.voiceStats.findMany({
        // Whole sessions only (state rows would show up as extra "sessions")
        where: { guild_id: serverId, member_id: userId, type: VOICE_TYPE.VOICE },
        orderBy: { issued_on: 'desc' },
        take: 10,
      }),
      // Same total for the period before, for the ↑/↓ comparison
      previousFilter
        ? req.db.$queryRaw<{ total_duration: bigint }[]>`
            SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint, 0) AS total_duration
            FROM voice_stats
            WHERE guild_id = ${serverId} AND member_id = ${userId}
              AND type = ${VOICE_TYPE.VOICE}
              ${previousFilter}
          `
        : Promise.resolve(null),
      // Who the user shared a channel with, and for how long: the overlap of
      // each of their sessions with everyone else's in the same channel
      req.db.$queryRaw<{ member_id: string; together: bigint }[]>`
        SELECT
          other.member_id,
          SUM(EXTRACT(EPOCH FROM (
            LEAST(COALESCE(me.ended_on, NOW()), COALESCE(other.ended_on, NOW()))
            - GREATEST(me.issued_on, other.issued_on)
          )) * 1000)::bigint AS together
        FROM voice_stats me
        JOIN voice_stats other
          ON other.guild_id = me.guild_id
         AND other.channel_id = me.channel_id
         AND other.type = ${VOICE_TYPE.VOICE}
         AND other.member_id <> me.member_id
         AND other.issued_on < COALESCE(me.ended_on, NOW())
         AND COALESCE(other.ended_on, NOW()) > me.issued_on
        WHERE me.guild_id = ${serverId}
          AND me.member_id = ${userId}
          AND me.type = ${VOICE_TYPE.VOICE}
          ${start ? Prisma.sql`AND me.issued_on >= ${start}` : Prisma.empty}
        GROUP BY other.member_id
        ORDER BY together DESC
        LIMIT 5
      `,
      // Text activity: messages per channel (the total is their sum)
      req.db.$queryRaw<{ channel_id: string; count: bigint }[]>`
        SELECT channel_id, COUNT(*)::bigint AS count
        FROM message_stats
        WHERE guild_id = ${serverId} AND user_id = ${userId}
          ${periodFilter(period, 'created_at')}
        GROUP BY channel_id
        ORDER BY count DESC
      `,
      previousPeriodFilter(period, 'created_at')
        ? req.db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count
            FROM message_stats
            WHERE guild_id = ${serverId} AND user_id = ${userId}
              ${previousPeriodFilter(period, 'created_at')!}
          `
        : Promise.resolve(null),
    ]);

    const messages = {
      count: messageChannelRows.reduce((sum, row) => sum + Number(row.count), 0),
      previousCount: previousMessageRows ? Number(previousMessageRows[0]?.count ?? 0) : null,
      topChannels: messageChannelRows.slice(0, 3).map((row) => ({
        channel: getChannelData(serverId, row.channel_id),
        count: Number(row.count),
      })),
    };

    const previousTotalDuration = previousRows
      ? Number(previousRows[0]?.total_duration ?? 0)
      : null;
    const companionMembers = await discordDirectory().members(
      serverId,
      companionRows.map((row) => row.member_id)
    );
    const companions = companionRows.map((row) => ({
      member: memberOrUnknown(companionMembers, row.member_id),
      togetherDuration: Number(row.together),
    }));

    const [totals] = totalsResult;
    const totalDuration = Number(totals.total_duration);
    const sessionCount = Number(totals.session_count);

    if (sessionCount === 0) {
      res.send({
        userId,
        summary: {
          totalDuration: 0,
          totalDurationHours: 0,
          totalDurationMinutes: 0,
          sessionCount: 0,
          uniqueChannels: 0,
          favoriteChannel: null,
          favoriteChannelDuration: 0,
          averageSessionDuration: 0,
          averageSessionDurationMinutes: 0,
          previousTotalDuration,
        },
        companions,
        messages,
        recentSessions: [],
        channelBreakdown: [],
      });
      return;
    }

    const channelBreakdown = channelRows.map((row) => {
      const duration = Number(row.total_duration);
      const parts = toDurationParts(duration);
      return {
        channel: getChannelData(serverId, row.channel_id),
        totalDuration: duration,
        totalDurationHours: parts.hours,
        totalDurationMinutes: parts.minutes,
        sessionCount: Number(row.session_count),
        percentage: totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0,
      };
    });

    const favoriteRow = channelRows[0];
    const favoriteChannelData = favoriteRow ? getChannelData(serverId, favoriteRow.channel_id) : null;

    const enrichedRecentSessions = recentSessions.map((session) => {
      // Open session (still in voice): live duration, endedOn stays null
      const endedOn = session.ended_on ?? new Date();
      const duration = endedOn.getTime() - session.issued_on.getTime();
      return {
        id: session.id,
        channel: getChannelData(serverId, session.channel_id),
        issuedOn: session.issued_on,
        endedOn: session.ended_on,
        duration,
        durationMinutes: Math.floor(duration / (1000 * 60)),
        type: session.type as VoiceActivityType,
      };
    });

    const totalParts = toDurationParts(totalDuration);

    // Nested `summary` matches the shared VoiceStatsUser DTO (and what the
    // user-profile component renders)
    res.send({
      userId,
      summary: {
        totalDuration,
        totalDurationHours: totalParts.hours,
        totalDurationMinutes: totalParts.minutes,
        sessionCount,
        uniqueChannels: channelRows.length,
        favoriteChannel: favoriteChannelData,
        favoriteChannelDuration: favoriteRow ? Number(favoriteRow.total_duration) : 0,
        averageSessionDuration: Math.floor(totalDuration / sessionCount),
        averageSessionDurationMinutes: Math.floor(totalDuration / sessionCount / (1000 * 60)),
        previousTotalDuration,
      },
      companions,
      messages,
      recentSessions: enrichedRecentSessions,
      channelBreakdown,
    });
  });
