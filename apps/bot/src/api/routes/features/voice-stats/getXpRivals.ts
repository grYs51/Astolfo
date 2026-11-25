import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { XpRivals } from '@nx-stolfo/api-interfaces';
import type { Db } from '../../../../db';
import { memberOrUnknown } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { currentRules, levelFor } from '../../../../xp/rules';

/** Most members the XP history's compare picker lists */
const MAX_RIVALS = 20;

/**
 * The current members (`memberIds`) with XP closest to the member's all-time total, closest first,
 * ties by id like the XP leaderboard; `difference` is theirs minus the member's
 */
export const xpRivals = (db: Pick<Db, '$queryRaw'>, opts: { serverId: string; userId: string; memberIds: string[] }) =>
  db.$queryRaw<{ member_id: string; xp: number; difference: number }[]>`
    WITH totals AS (
      SELECT member_id, SUM(amount)::int AS xp
      FROM xp_events
      WHERE guild_id = ${opts.serverId}
      GROUP BY member_id
    ),
    me AS (
      SELECT COALESCE((SELECT xp FROM totals WHERE member_id = ${opts.userId}), 0) AS xp
    )
    SELECT t.member_id, t.xp, t.xp - me.xp AS difference
    FROM totals t, me
    WHERE t.xp > 0 AND t.member_id <> ${opts.userId} AND t.member_id = ANY(${opts.memberIds})
    ORDER BY ABS(t.xp - me.xp), t.member_id
    LIMIT ${MAX_RIVALS}
  `;

/** The members to compare a member's XP history with */
export const getXpRivals: RequestHandler<{ serverId: string; userId: string }, XpRivals> = asyncHandler(
  async (req, res) => {
    const { serverId, userId } = req.params;
    const directory = discordDirectory();
    const rows = await xpRivals(req.db, { serverId, userId, memberIds: await directory.memberIds(serverId) });
    const members = await directory.members(serverId, rows.map((row) => row.member_id));
    const rules = currentRules();
    res.send({
      rivals: rows.map((row) => ({
        member: memberOrUnknown(members, row.member_id),
        xp: row.xp,
        level: levelFor(row.xp, rules),
        difference: row.difference,
      })),
    });
  }
);
