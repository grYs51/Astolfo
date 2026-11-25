import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { XpLeaderboard, XpLeaderboardEntry } from '@nx-stolfo/api-interfaces';
import type { Db } from '../../../../db';
import { memberOrUnknown } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { currentRules, levelFor } from '../../../../xp/rules';
import { NOW_UTC } from './presence-sql';

export const XP_PAGE_SIZE = 25;

export interface XpRankRow {
  member_id: string;
  xp: number;
  week_xp: number;
  rank: number;
  /** null: no XP 7 days ago */
  rank_before: number | null;
}

/**
 * Every current member with XP, ranked by all-time XP now and 7 days ago (ties by id, like /stats).
 * The member list already goes into the query, so the ranks coming back are the same size.
 */
export const xpRanks = (db: Pick<Db, '$queryRaw'>, guildId: string, memberIds: string[]) => db.$queryRaw<XpRankRow[]>`
  WITH totals AS (
    SELECT member_id,
           SUM(amount)::int AS xp,
           COALESCE(SUM(amount) FILTER (WHERE created_at < ${NOW_UTC} - INTERVAL '7 days'), 0)::int AS xp_before
    FROM xp_events
    WHERE guild_id = ${guildId} AND member_id = ANY(${memberIds})
    GROUP BY member_id
  ),
  ranked AS (
    SELECT member_id, xp, (xp - xp_before)::int AS week_xp,
           ROW_NUMBER() OVER (ORDER BY xp DESC, member_id)::int AS rank,
           CASE WHEN xp_before > 0 THEN ROW_NUMBER() OVER (ORDER BY xp_before DESC, member_id)::int END AS rank_before
    FROM totals
  )
  SELECT * FROM ranked WHERE xp > 0 ORDER BY rank
`;

/**
 * Members ranked by level, i.e. all-time XP, 25 a page (`?page=`), with the viewer's row as `me`.
 * `?around=<memberId>` returns that member and up to two on each side instead (the rank race).
 */
export const getXpLeaderboard: RequestHandler<
  { serverId: string },
  XpLeaderboard,
  unknown,
  { page?: string; around?: string }
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const ranks = await xpRanks(req.db, serverId, await discordDirectory().memberIds(serverId));

  const pages = Math.max(1, Math.ceil(ranks.length / XP_PAGE_SIZE));
  const around = ranks.find((row) => row.member_id === req.query.around);
  const page = around
    ? Math.ceil(around.rank / XP_PAGE_SIZE)
    : Math.min(Math.max(Number.parseInt(req.query.page ?? '', 10) || 1, 1), pages);
  const rows = around
    ? ranks.slice(Math.max(around.rank - 3, 0), around.rank + 2)
    : req.query.around
      ? []
      : ranks.slice((page - 1) * XP_PAGE_SIZE, page * XP_PAGE_SIZE);
  const me = ranks.find((row) => row.member_id === req.user?.id);

  const members = await discordDirectory().members(
    serverId,
    [...rows, ...(me ? [me] : [])].map((row) => row.member_id)
  );
  const rules = currentRules();
  const entry = (row: XpRankRow): XpLeaderboardEntry => ({
    member: memberOrUnknown(members, row.member_id),
    rank: row.rank,
    xp: row.xp,
    level: levelFor(row.xp, rules),
    weekXp: row.week_xp,
    rankChange: row.rank_before === null ? 0 : row.rank_before - row.rank,
    isNew: row.rank_before === null,
  });

  res.send({ leaderboard: rows.map(entry), me: me ? entry(me) : null, page, pages, total: ranks.length });
});
