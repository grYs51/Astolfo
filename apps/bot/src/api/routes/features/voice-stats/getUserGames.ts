import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { DashboardPeriod, RpsMove, UserGames } from '@nx-stolfo/api-interfaces';
import { isHiddenFrom, parsePeriod, periodFilter } from '../helpers';
import { GAME_TYPES, SCORING } from '../../../../utils/handlers/games-handler';

type RecordRow = {
  games: bigint;
  wins: bigint;
  losses: bigint;
  ties: bigint;
  favourite: RpsMove | null;
  nemesis: RpsMove | null;
  h2h_games: bigint;
  h2h_wins: bigint;
  h2h_losses: bigint;
  h2h_ties: bigint;
};

/** One member's rock-paper-scissors record in a server, and how they do against the viewer. */
export const getUserGames: RequestHandler<
  { serverId: string; userId: string },
  UserGames | { error: string }
> = asyncHandler(async (req, res) => {
  const { serverId, userId } = req.params;
  const viewerId = req.user?.id ?? '';
  if (await isHiddenFrom(req.db, userId, viewerId)) {
    res.status(403).send({ error: 'private' });
    return;
  }
  const period: DashboardPeriod = parsePeriod(
    req.query.period,
    ['week', 'month', 'year', 'all'],
    'all'
  );

  // One row per game this member played, joined to the opponent's row
  const [row] = await req.db.$queryRaw<RecordRow[]>`
    SELECT COUNT(*)::bigint AS games,
           COUNT(*) FILTER (WHERE me.result = ${SCORING.WIN})::bigint AS wins,
           COUNT(*) FILTER (WHERE me.result = ${SCORING.LOSS})::bigint AS losses,
           COUNT(*) FILTER (WHERE me.result = ${SCORING.TIE})::bigint AS ties,
           MODE() WITHIN GROUP (ORDER BY me.move) AS favourite,
           MODE() WITHIN GROUP (ORDER BY opp.move) FILTER (WHERE me.result = ${SCORING.LOSS}) AS nemesis,
           COUNT(*) FILTER (WHERE opp.user_id = ${viewerId})::bigint AS h2h_games,
           COUNT(*) FILTER (WHERE opp.user_id = ${viewerId} AND me.result = ${SCORING.WIN})::bigint AS h2h_wins,
           COUNT(*) FILTER (WHERE opp.user_id = ${viewerId} AND me.result = ${SCORING.LOSS})::bigint AS h2h_losses,
           COUNT(*) FILTER (WHERE opp.user_id = ${viewerId} AND me.result = ${SCORING.TIE})::bigint AS h2h_ties
    FROM game_player me
    JOIN game_result gr ON gr.id = me.game_result_id
    JOIN game_player opp ON opp.game_result_id = gr.id AND opp.id <> me.id
    WHERE me.user_id = ${userId}
      AND gr.guild_id = ${serverId}
      AND gr.game_type_id = ${GAME_TYPES.ROCK_PAPER_SCISSORS}
      ${periodFilter(period, 'created_at')}
  `;

  res.send({
    period,
    games: Number(row.games),
    wins: Number(row.wins),
    losses: Number(row.losses),
    ties: Number(row.ties),
    favouriteMove: row.favourite,
    nemesisMove: row.nemesis,
    headToHead:
      userId === viewerId
        ? null
        : {
            games: Number(row.h2h_games),
            wins: Number(row.h2h_wins),
            losses: Number(row.h2h_losses),
            ties: Number(row.h2h_ties),
          },
  });
});
