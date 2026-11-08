import { Prisma } from '@prisma/client';
import type { Db } from '../../../../db';
import { getStartDateForPeriod } from '../helpers';

/** Now as a UTC wall-clock timestamp, like the stored columns */
export const NOW_UTC = Prisma.sql`(NOW() AT TIME ZONE 'UTC')`;

/** Statuses that count as online */
export const ONLINE = Prisma.sql`status IN ('online', 'idle', 'dnd')`;

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
 * One row per (user, UTC hour) with the seconds spent online in that hour,
 * from `lo` until now. Each interval is cut into the hours it covers, so a
 * status that lasts all evening counts in every hour of it.
 * `userFilter` must start with the user condition (no leading AND).
 */
export const onlinePieces = (userFilter: Prisma.Sql, lo: Date) => Prisma.sql`
  SELECT user_id, h,
    EXTRACT(EPOCH FROM LEAST(e, h + INTERVAL '1 hour') - GREATEST(s, h)) AS secs
  FROM (
    SELECT user_id, GREATEST(created_at, ${lo}::timestamp) AS s, COALESCE(ended_at, ${NOW_UTC}) AS e
    FROM user_statuses
    WHERE ${userFilter}
      AND ${ONLINE}
      AND COALESCE(ended_at, ${NOW_UTC}) > ${lo}::timestamp
  ) spans,
  LATERAL generate_series(date_trunc('hour', s), e, INTERVAL '1 hour') AS h
  WHERE h < e
`;

/** How often each local (day, hour) occurs between `lo` and now */
export const hourSlots = (lo: Date, tz: string) => Prisma.sql`
  SELECT EXTRACT(DOW FROM ${localHour(tz)})::int AS dow,
         EXTRACT(HOUR FROM ${localHour(tz)})::int AS hour,
         COUNT(*)::float8 AS n
  FROM generate_series(date_trunc('hour', ${lo}::timestamp), ${NOW_UTC}, INTERVAL '1 hour') AS h
  GROUP BY 1, 2
`;
