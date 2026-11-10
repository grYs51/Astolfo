import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { XpLeaderboard } from '@nx-stolfo/api-interfaces';
import { memberOrUnknown } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { currentRules, levelFor } from '../../../../xp/rules';

/** Members ranked by level, i.e. all-time XP (the member overview's ranking). */
export const getXpLeaderboard: RequestHandler<{ serverId: string }, XpLeaderboard> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Up to 100 so the viewer's rank is known; ties broken by id like /stats
    const rows = await req.db.$queryRaw<{ member_id: string; xp: number }[]>`
      SELECT member_id, SUM(amount)::int AS xp
      FROM xp_events
      WHERE guild_id = ${serverId}
      GROUP BY member_id
      HAVING SUM(amount) > 0
      ORDER BY xp DESC, member_id
      LIMIT 100
    `;

    const members = await discordDirectory().members(
      serverId,
      rows.map((row) => row.member_id)
    );
    const rules = currentRules();

    res.send({
      leaderboard: rows.map((row) => ({
        member: memberOrUnknown(members, row.member_id),
        xp: row.xp,
        level: levelFor(row.xp, rules),
      })),
    });
  });
