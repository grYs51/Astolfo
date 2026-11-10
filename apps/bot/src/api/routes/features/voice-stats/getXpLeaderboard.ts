import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { XpLeaderboard } from '@nx-stolfo/api-interfaces';
import { memberOrUnknown, parsePeriod, periodFilter } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';

/** Members ranked by XP earned in the period (the member overview's ranking). */
export const getXpLeaderboard: RequestHandler<{ serverId: string }, XpLeaderboard> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period = parsePeriod(req.query.period, ['week', 'month', 'year', 'all'], 'all');

    // Up to 100 so the viewer's rank is known; ties broken by id like /stats
    const rows = await req.db.$queryRaw<{ member_id: string; xp: number }[]>`
      SELECT member_id, SUM(amount)::int AS xp
      FROM xp_events
      WHERE guild_id = ${serverId}
        ${periodFilter(period, 'created_at')}
      GROUP BY member_id
      HAVING SUM(amount) > 0
      ORDER BY xp DESC, member_id
      LIMIT 100
    `;

    const members = await discordDirectory().members(
      serverId,
      rows.map((row) => row.member_id)
    );

    res.send({
      period,
      leaderboard: rows.map((row) => ({ member: memberOrUnknown(members, row.member_id), xp: row.xp })),
    });
  });
