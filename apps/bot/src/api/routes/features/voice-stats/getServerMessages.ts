import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { DashboardPeriod, ServerMessageStats } from '@nx-stolfo/api-interfaces';
import {
  getChannelData,
  memberOrUnknown,
  parsePeriod,
  periodFilter,
  previousPeriodFilter,
} from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';

/** Text activity of a server for a period: totals, top channels, top members. */
export const getServerMessages: RequestHandler<{ serverId: string }, ServerMessageStats> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period: DashboardPeriod = parsePeriod(
      req.query.period,
      ['week', 'month', 'year', 'all'],
      'all'
    );
    const dateFilter = periodFilter(period, 'created_at');
    const previousFilter = previousPeriodFilter(period, 'created_at');

    const [[totals], previousRows, channelRows, memberRows] = await Promise.all([
      req.db.$queryRaw<{ total: bigint; members: bigint }[]>`
        SELECT COUNT(*)::bigint AS total, COUNT(DISTINCT user_id)::bigint AS members
        FROM message_stats
        WHERE guild_id = ${serverId}
          ${dateFilter}
      `,
      previousFilter
        ? req.db.$queryRaw<{ total: bigint }[]>`
            SELECT COUNT(*)::bigint AS total
            FROM message_stats
            WHERE guild_id = ${serverId}
              ${previousFilter}
          `
        : Promise.resolve(null),
      req.db.$queryRaw<{ channel_id: string; count: bigint }[]>`
        SELECT channel_id, COUNT(*)::bigint AS count
        FROM message_stats
        WHERE guild_id = ${serverId}
          ${dateFilter}
        GROUP BY channel_id
        ORDER BY count DESC
        LIMIT 5
      `,
      // Up to 100 so the viewer's rank is known even outside the shown top
      req.db.$queryRaw<{ user_id: string; count: bigint; channels: bigint }[]>`
        SELECT user_id, COUNT(*)::bigint AS count, COUNT(DISTINCT channel_id)::bigint AS channels
        FROM message_stats
        WHERE guild_id = ${serverId}
          ${dateFilter}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 100
      `,
    ]);

    const members = await discordDirectory().members(
      serverId,
      memberRows.map((row) => row.user_id)
    );

    res.send({
      period,
      total: Number(totals.total),
      previousTotal: previousRows ? Number(previousRows[0]?.total ?? 0) : null,
      activeMembers: Number(totals.members),
      topChannels: channelRows.map((row) => ({
        channel: getChannelData(serverId, row.channel_id),
        count: Number(row.count),
      })),
      topMembers: memberRows.map((row) => ({
        member: memberOrUnknown(members, row.user_id),
        count: Number(row.count),
        channels: Number(row.channels),
      })),
    });
  });
