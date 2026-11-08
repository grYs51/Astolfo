import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { DashboardPeriod, UserPresence } from '@nx-stolfo/api-interfaces';
import { getTimeZone, isHiddenFrom, parsePeriod } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import {
  endsAfter,
  hourSlots,
  localHour,
  NOW_UTC,
  ONLINE,
  onlinePieces,
  presenceWindowStart,
  wholeHours,
} from './presence-sql';

type StatusRow = { status: string; ms: number };
type HourRow = { hour: number; share: number };

/** One member's online time: hours per status and their online hours of the day. */
export const getUserPresence: RequestHandler<
  { serverId: string; userId: string },
  UserPresence | { error: string }
> = asyncHandler(async (req, res) => {
  const { serverId, userId } = req.params;
  // Statuses have no guild: without this, any server's members could read
  // the status history of anyone the bot sees. Checked first, so outsiders
  // can't tell who is hidden either.
  if (!(await discordDirectory().isMember(serverId, userId))) {
    res.status(404).send({ error: 'not a member of this server' });
    return;
  }
  if (await isHiddenFrom(req.db, userId, req.user?.id ?? '')) {
    res.status(403).send({ error: 'private' });
    return;
  }
  const period: DashboardPeriod = parsePeriod(
    req.query.period,
    ['week', 'month', 'year', 'all'],
    'month'
  );
  const tz = getTimeZone(req.query.tz);
  const lo = await presenceWindowStart(req.db, period, [userId]);
  // Same length as the period, right before it; none for 'all'
  const previousLo =
    period === 'all' ? null : new Date(lo.getTime() - (Date.now() - lo.getTime()));
  const local = localHour(tz);
  const hours = wholeHours(lo);

  const [statusRows, previousRows, hourRows] = await Promise.all([
    req.db.$queryRaw<StatusRow[]>`
      SELECT status,
             SUM(EXTRACT(EPOCH FROM COALESCE(ended_at, ${NOW_UTC}) - GREATEST(created_at, ${lo}::timestamp)) * 1000)::float8 AS ms
      FROM user_statuses
      WHERE user_id = ${userId}
        AND ${ONLINE}
        AND ${endsAfter(lo)}
      GROUP BY status
    `,
    previousLo
      ? req.db.$queryRaw<{ ms: number | null }[]>`
          SELECT SUM(EXTRACT(EPOCH FROM
                   LEAST(COALESCE(ended_at, ${NOW_UTC}), ${lo}::timestamp)
                   - GREATEST(created_at, ${previousLo}::timestamp)) * 1000)::float8 AS ms
          FROM user_statuses
          WHERE user_id = ${userId}
            AND ${ONLINE}
            AND created_at < ${lo}::timestamp
            AND ${endsAfter(previousLo)}
        `
      : Promise.resolve(null),
    req.db.$queryRaw<HourRow[]>`
      WITH pieces AS (${onlinePieces(Prisma.sql`user_id = ${userId}`, hours.lo, hours.hi)}),
      hours AS (
        SELECT EXTRACT(HOUR FROM ${local})::int AS hour, SUM(secs) AS secs
        FROM pieces
        GROUP BY 1
      ),
      slots AS (
        SELECT hour, SUM(n) AS n FROM (${hourSlots(hours.lo, hours.hi, tz)}) per_day GROUP BY hour
      )
      SELECT slots.hour, (COALESCE(hours.secs, 0) / 3600 / slots.n)::float8 AS share
      FROM slots
      LEFT JOIN hours USING (hour)
    `,
  ]);

  const ms = (status: string) => statusRows.find((row) => row.status === status)?.ms ?? 0;
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const row of hourRows) byHour[row.hour] = row.share;

  res.send({
    period,
    online: ms('online'),
    idle: ms('idle'),
    dnd: ms('dnd'),
    previousTotal: previousRows ? (previousRows[0]?.ms ?? 0) : null,
    byHour,
  });
});
