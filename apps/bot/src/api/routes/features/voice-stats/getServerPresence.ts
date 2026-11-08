import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import {
  DashboardPeriod,
  PresenceRhythmMember,
  ServerPresence,
} from '@nx-stolfo/api-interfaces';
import { getTimeZone, memberOrUnknown, parsePeriod, visibleMembersOnly } from '../helpers';
import { discordDirectory } from '../../../utils/discord-directory';
import {
  hourSlots,
  localHour,
  onlinePieces,
  presenceWindowStart,
  wholeHours,
} from './presence-sql';

/** Members need this much online time in the period to be ranked */
const MIN_ONLINE_SECONDS = 5 * 3600;
/** …and this share of it inside the window, so the list isn't padded */
const MIN_SHARE = 0.1;

type CellRow = { dow: number; hour: number; avg_online: number };
type RhythmRow = { user_id: string; total: number; night: number; early: number };

/**
 * Server pulse: average members online per hour of the week, plus the night
 * owls and early birds. Statuses have no guild, so "the server" is its current
 * member list.
 */
export const getServerPresence: RequestHandler<{ serverId: string }, ServerPresence> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const period: DashboardPeriod = parsePeriod(
      req.query.period,
      ['week', 'month', 'year', 'all'],
      'month'
    );
    const tz = getTimeZone(req.query.tz);
    const ids = await discordDirectory().memberIds(serverId);
    const { lo, hi } = wholeHours(await presenceWindowStart(req.db, period, ids));
    const local = localHour(tz);

    const [cellRows, rhythmRows] = await Promise.all([
      req.db.$queryRaw<CellRow[]>`
        WITH pieces AS (${onlinePieces(Prisma.sql`user_id = ANY(${ids})`, lo, hi)}),
        cells AS (
          SELECT EXTRACT(DOW FROM ${local})::int AS dow,
                 EXTRACT(HOUR FROM ${local})::int AS hour,
                 SUM(secs) AS secs
          FROM pieces
          GROUP BY 1, 2
        ),
        slots AS (${hourSlots(lo, hi, tz)})
        SELECT slots.dow, slots.hour,
               (COALESCE(cells.secs, 0) / 3600 / slots.n)::float8 AS avg_online
        FROM slots
        LEFT JOIN cells USING (dow, hour)
      `,
      req.db.$queryRaw<RhythmRow[]>`
        WITH pieces AS (${onlinePieces(
          Prisma.sql`user_id = ANY(${ids}) ${visibleMembersOnly('user_id', req.user?.id ?? '')}`,
          lo,
          hi
        )})
        SELECT user_id,
               SUM(secs)::float8 AS total,
               COALESCE(SUM(secs) FILTER (WHERE EXTRACT(HOUR FROM ${local}) < 5), 0)::float8 AS night,
               COALESCE(SUM(secs) FILTER (WHERE EXTRACT(HOUR FROM ${local}) BETWEEN 5 AND 8), 0)::float8 AS early
        FROM pieces
        GROUP BY user_id
        HAVING SUM(secs) >= ${MIN_ONLINE_SECONDS}
      `,
    ]);

    // At most one row per member, so ranking in JS is cheap
    const top = (window: 'night' | 'early') =>
      rhythmRows
        .filter((row) => row[window] / row.total >= MIN_SHARE)
        .sort((a, b) => b[window] / b.total - a[window] / a.total)
        .slice(0, 3);
    const owls = top('night');
    const birds = top('early');
    const members = await discordDirectory().members(
      serverId,
      [...owls, ...birds].map((row) => row.user_id)
    );
    const rhythm = (rows: RhythmRow[], window: 'night' | 'early'): PresenceRhythmMember[] =>
      rows.map((row) => ({
        member: memberOrUnknown(members, row.user_id),
        share: row[window] / row.total,
        onlineHours: Math.round(row.total / 3600),
      }));

    const cells = new Map(cellRows.map((row) => [`${row.dow}-${row.hour}`, row.avg_online]));
    res.send({
      period,
      members: ids.length,
      cells: Array.from({ length: 168 }, (_, i) => {
        const dayOfWeek = Math.floor(i / 24);
        const hour = i % 24;
        return { dayOfWeek, hour, avgOnline: cells.get(`${dayOfWeek}-${hour}`) ?? 0 };
      }),
      nightOwls: rhythm(owls, 'night'),
      earlyBirds: rhythm(birds, 'early'),
    });
  });
