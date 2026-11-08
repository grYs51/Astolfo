import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { DashboardPeriod, ServerGames } from '@nx-stolfo/api-interfaces';
import { memberOrUnknown, parsePeriod, periodFilter, visibleMembersOnly } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import { GAME_TYPES, SCORING } from '../../../../utils/handlers/games-handler';

type TotalsRow = { games: bigint; players: bigint };
type LeaderRow = { user_id: string; games: bigint; wins: bigint; losses: bigint; ties: bigint };
type MatchupRow = {
  a_id: string;
  b_id: string;
  games: bigint;
  a_wins: bigint;
  b_wins: bigint;
  ties: bigint;
};

/** Rock-paper-scissors in a server: totals, leaderboard and most-played pairs. */
export const getServerGames: RequestHandler<{ serverId: string }, ServerGames> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period: DashboardPeriod = parsePeriod(
      req.query.period,
      ['week', 'month', 'year', 'all'],
      'all'
    );
    const viewerId = req.user?.id ?? '';
    // created_at only exists on game_result, so the filter is unambiguous
    const games = Prisma.sql`
      gr.guild_id = ${serverId}
      AND gr.game_type_id = ${GAME_TYPES.ROCK_PAPER_SCISSORS}
      ${periodFilter(period, 'created_at')}
    `;

    const [[totals], leaderRows, matchupRows] = await Promise.all([
      req.db.$queryRaw<TotalsRow[]>`
        SELECT COUNT(DISTINCT gr.id)::bigint AS games, COUNT(DISTINCT gp.user_id)::bigint AS players
        FROM game_result gr
        JOIN game_player gp ON gp.game_result_id = gr.id
        WHERE ${games}
      `,
      req.db.$queryRaw<LeaderRow[]>`
        SELECT gp.user_id,
               COUNT(*)::bigint AS games,
               COUNT(*) FILTER (WHERE gp.result = ${SCORING.WIN})::bigint AS wins,
               COUNT(*) FILTER (WHERE gp.result = ${SCORING.LOSS})::bigint AS losses,
               COUNT(*) FILTER (WHERE gp.result = ${SCORING.TIE})::bigint AS ties
        FROM game_result gr
        JOIN game_player gp ON gp.game_result_id = gr.id
        WHERE ${games}
          ${visibleMembersOnly('user_id', viewerId)}
        GROUP BY gp.user_id
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) FILTER (WHERE gp.result = ${SCORING.WIN})::float8 / COUNT(*) DESC, games DESC
        LIMIT 10
      `,
      req.db.$queryRaw<MatchupRow[]>`
        SELECT a.user_id AS a_id, b.user_id AS b_id,
               COUNT(*)::bigint AS games,
               COUNT(*) FILTER (WHERE a.result = ${SCORING.WIN})::bigint AS a_wins,
               COUNT(*) FILTER (WHERE b.result = ${SCORING.WIN})::bigint AS b_wins,
               COUNT(*) FILTER (WHERE a.result = ${SCORING.TIE})::bigint AS ties
        FROM game_result gr
        JOIN game_player a ON a.game_result_id = gr.id
        JOIN game_player b ON b.game_result_id = gr.id AND a.user_id < b.user_id
        WHERE ${games}
          ${visibleMembersOnly('a.user_id', viewerId)}
          ${visibleMembersOnly('b.user_id', viewerId)}
        GROUP BY 1, 2
        ORDER BY games DESC
        LIMIT 5
      `,
    ]);

    const members = await discordDirectory().members(serverId, [
      ...new Set([
        ...leaderRows.map((row) => row.user_id),
        ...matchupRows.flatMap((row) => [row.a_id, row.b_id]),
      ]),
    ]);

    res.send({
      period,
      games: Number(totals.games),
      players: Number(totals.players),
      leaderboard: leaderRows.map((row) => ({
        member: memberOrUnknown(members, row.user_id),
        games: Number(row.games),
        wins: Number(row.wins),
        losses: Number(row.losses),
        ties: Number(row.ties),
        winRate: Number(row.wins) / Number(row.games),
      })),
      matchups: matchupRows.map((row) => ({
        a: memberOrUnknown(members, row.a_id),
        b: memberOrUnknown(members, row.b_id),
        games: Number(row.games),
        aWins: Number(row.a_wins),
        bWins: Number(row.b_wins),
        ties: Number(row.ties),
      })),
    });
  });
