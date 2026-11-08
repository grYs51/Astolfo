import { Prisma } from '@prisma/client';
import type { Db } from '../../../../db';
import { getStartDateForPeriod } from '../helpers';

const HOUR_MS = 3_600_000;

/** Now as a UTC wall-clock timestamp, like the stored columns */
export const NOW_UTC = Prisma.sql`(NOW() AT TIME ZONE 'UTC')`;

/** Statuses that count as online */
export const ONLINE = Prisma.sql`status IN ('online', 'idle', 'dnd')`;

/**
 * Rows still running at or after `from`. Written as an OR (not
 * COALESCE(ended_at, now) > from) so the (user_id, ended_at) index serves it.
 */
export const endsAfter = (from: Date) =>
  Prisma.sql`(ended_at > ${from}::timestamp OR ended_at IS NULL)`;

/** `h` (a UTC hour) as wall-clock time in `tz` */
export const localHour = (tz: string) =>
  Prisma.sql`((h AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;

/**
 * Start of the window: the period start, or for 'all' the first status row
 * of these users (so the hour slots don't reach back to 1970).
 */
export const presenceWindowStart = async (
  db: Pick<Db, '$queryRaw'>,
  period: string,
  userIds: string[]
): Promise<Date> => {
  const start = getStartDateForPeriod(period);
  if (start) return start;
  const [row] = await db.$queryRaw<{ lo: Date | null }[]>`
    SELECT MIN(created_at) AS lo FROM user_statuses WHERE user_id = ANY(${userIds})
  `;
  return row?.lo ?? new Date();
};

/**
 * Whole UTC hours inside [start, now): the first full hour after `start` up
 * to the last full hour before now, so no hour slot is half counted.
 */
export const wholeHours = (start: Date) => ({
  lo: new Date(Math.ceil(start.getTime() / HOUR_MS) * HOUR_MS),
  hi: new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS),
});

/**
 * One row per (user, UTC hour) with the seconds spent online in that hour,
 * for the whole hours in [lo, hi). Each interval is cut into the hours it
 * covers, so a status that lasts all evening counts in every hour of it.
 * `userFilter` must start with the user condition (no leading AND).
 */
export const onlinePieces = (userFilter: Prisma.Sql, lo: Date, hi: Date) => Prisma.sql`
  SELECT user_id, h,
    EXTRACT(EPOCH FROM LEAST(e, h + INTERVAL '1 hour') - GREATEST(s, h)) AS secs
  FROM (
    SELECT user_id,
           GREATEST(created_at, ${lo}::timestamp) AS s,
           LEAST(COALESCE(ended_at, ${NOW_UTC}), ${hi}::timestamp) AS e
    FROM user_statuses
    WHERE ${userFilter}
      AND ${ONLINE}
      AND ${endsAfter(lo)}
      AND created_at < ${hi}::timestamp
  ) spans,
  LATERAL generate_series(date_trunc('hour', s), e, INTERVAL '1 hour') AS h
  WHERE h < e
`;

/** How often each local (day, hour) occurs among the whole hours in [lo, hi) */
export const hourSlots = (lo: Date, hi: Date, tz: string) => Prisma.sql`
  SELECT EXTRACT(DOW FROM ${localHour(tz)})::int AS dow,
         EXTRACT(HOUR FROM ${localHour(tz)})::int AS hour,
         COUNT(*)::float8 AS n
  FROM generate_series(${lo}::timestamp, ${hi}::timestamp - INTERVAL '1 hour', INTERVAL '1 hour') AS h
  GROUP BY 1, 2
`;
