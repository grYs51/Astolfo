import type { Db } from '../db';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';

type QueryDb = Pick<Db, '$queryRaw'>;

export interface TriviaStats {
  answered: number;
  correct: number;
  /** Questions where they were the quickest right answer */
  firsts: number;
  xp: number;
  /** The quickest right answer; undefined until one is saved with a time */
  fastestMs?: number;
  /** The category with the most right answers (at least BEST_CATEGORY_MIN answered), ties by accuracy */
  bestCategory?: { name: string; answered: number; correct: number };
}

/** A category needs this many answers to count as the best, so one lucky answer doesn't win it */
export const BEST_CATEGORY_MIN = 5;

/** One member's trivia in one server, from the saved questions and the TRIVIA XP rows */
export const getTriviaStats = async (db: QueryDb, guildId: string, memberId: string): Promise<TriviaStats> => {
  // `::text` because jsonb `->>` takes text or an int, and an untyped parameter is ambiguous
  const [[totals], [best], [xp]] = await Promise.all([
    db.$queryRaw<{ answered: bigint; correct: bigint; firsts: bigint; fastest: number | null }[]>`
      SELECT COUNT(*)::bigint AS answered,
             COUNT(*) FILTER (WHERE p.result = ${SCORING.WIN})::bigint AS correct,
             COUNT(*) FILTER (WHERE r.metadata->'correctOrder'->>0 = ${memberId}::text)::bigint AS firsts,
             MIN((r.metadata->'answerMs'->>${memberId}::text)::int) FILTER (WHERE p.result = ${SCORING.WIN}) AS fastest
      FROM game_player p
      JOIN game_result r ON r.id = p.game_result_id
      WHERE r.guild_id = ${guildId} AND r.game_type_id = ${GAME_TYPES.TRIVIA} AND p.user_id = ${memberId}
    `,
    db.$queryRaw<{ name: string; answered: bigint; correct: bigint }[]>`
      SELECT r.metadata->>'category' AS name,
             COUNT(*)::bigint AS answered,
             COUNT(*) FILTER (WHERE p.result = ${SCORING.WIN})::bigint AS correct
      FROM game_player p
      JOIN game_result r ON r.id = p.game_result_id
      WHERE r.guild_id = ${guildId} AND r.game_type_id = ${GAME_TYPES.TRIVIA} AND p.user_id = ${memberId}
      GROUP BY 1
      HAVING COUNT(*) >= ${BEST_CATEGORY_MIN}
      ORDER BY COUNT(*) FILTER (WHERE p.result = ${SCORING.WIN}) DESC,
               COUNT(*) FILTER (WHERE p.result = ${SCORING.WIN})::float / COUNT(*) DESC,
               1
      LIMIT 1
    `,
    db.$queryRaw<{ xp: bigint }[]>`
      SELECT COALESCE(SUM(amount), 0)::bigint AS xp
      FROM xp_events
      WHERE guild_id = ${guildId} AND member_id = ${memberId} AND source = 'TRIVIA'
    `,
  ]);
  return {
    answered: Number(totals?.answered ?? 0),
    correct: Number(totals?.correct ?? 0),
    firsts: Number(totals?.firsts ?? 0),
    xp: Number(xp?.xp ?? 0),
    fastestMs: totals?.fastest ?? undefined,
    bestCategory: best && best.name ? { name: best.name, answered: Number(best.answered), correct: Number(best.correct) } : undefined,
  };
};
