import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { DashboardPeriod, XpHistory } from '@nx-stolfo/api-interfaces';
import type { Db } from '../../../../db';
import { getStartDateForPeriod, getTimeZone, localTime, parsePeriod } from '../helpers';
import { currentRules, levelLines } from '../../../../xp/rules';

type BucketRow = { bucket: Date; gained: number; total: number; start_xp: number };

/**
 * A member's running XP total per local day or week in `tz`, from the bucket holding `since`
 * (from their first XP when undefined) to the one holding `now`, with the total before it.
 */
export const xpHistoryPoints = async (
  db: Pick<Db, '$queryRaw'>,
  opts: { serverId: string; userId: string; since: Date | undefined; now: Date; tz: string; granularity: XpHistory['granularity'] }
) => {
  const { serverId, userId, since, now, tz, granularity } = opts;
  // Wall-clock times in tz, as the bucketed column is
  const local = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE ${tz})`;
  const step = Prisma.raw(`INTERVAL '1 ${granularity}'`);

  // A member's whole ledger is read for the total before the period: the (guild, member, created_at) index covers it
  const rows = await db.$queryRaw<BucketRow[]>`
    WITH mine AS (
      SELECT date_trunc(${granularity}, ${localTime('created_at', tz)}) AS bucket, amount
      FROM xp_events
      WHERE guild_id = ${serverId} AND member_id = ${userId}
    ),
    first AS (
      SELECT COALESCE(date_trunc(${granularity}, ${since ? local(since) : Prisma.sql`NULL::timestamp`}), MIN(bucket)) AS bucket
      FROM mine
    ),
    earlier AS (
      SELECT COALESCE(SUM(amount), 0)::int AS xp FROM mine, first WHERE mine.bucket < first.bucket
    )
    SELECT g.b AS bucket,
      COALESCE(SUM(m.amount), 0)::int AS gained,
      ((SELECT xp FROM earlier) + SUM(COALESCE(SUM(m.amount), 0)) OVER (ORDER BY g.b))::int AS total,
      (SELECT xp FROM earlier) AS start_xp
    FROM first
    CROSS JOIN generate_series(first.bucket, date_trunc(${granularity}, ${local(now)}), ${step}) AS g(b)
    LEFT JOIN mine m ON m.bucket = g.b
    GROUP BY g.b
    ORDER BY g.b
  `;

  // `bucket` is zone-less wall-clock time read as UTC, so its ISO date is the local date
  return {
    startXp: rows[0]?.start_xp ?? 0,
    points: rows.map((row) => ({ date: row.bucket.toISOString().substring(0, 10), gained: row.gained, total: row.total })),
  };
};

/** One member's running XP total over the page period, with the level lines it crossed */
export const getXpHistory: RequestHandler<{ serverId: string; userId: string }, XpHistory> = asyncHandler(
  async (req, res) => {
    const { serverId, userId } = req.params;
    const period: DashboardPeriod = parsePeriod(req.query.period, ['week', 'month', 'year', 'all'], 'all');
    const granularity = period === 'week' || period === 'month' ? 'day' : 'week';
    const { startXp, points } = await xpHistoryPoints(req.db, {
      serverId,
      userId,
      since: getStartDateForPeriod(period),
      now: new Date(),
      tz: getTimeZone(req.query.tz),
      granularity,
    });
    const endXp = points[points.length - 1]?.total ?? startXp;
    res.send({ granularity, startXp, points, levels: levelLines(startXp, endXp, currentRules()) });
  }
);
