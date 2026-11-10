import { ActivityCalendar } from '@nx-stolfo/api-interfaces';
import { Prisma } from '@prisma/client';
import type { Db } from '../../../../db';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { localIssuedOn, localTime } from '../helpers';
import { NOW_UTC } from './presence-sql';

type DayRow = { day: Date; minutes: number; messages: number };

/**
 * Daily voice minutes and messages over the last 12 months, for the whole
 * server or one member, in time zone `tz` (the calendar endpoint and the stats card).
 * The caller checks the member doesn't hide from the viewer.
 */
export const activityCalendar = async (
  db: Pick<Db, '$queryRaw'>,
  serverId: string,
  userId: string | undefined,
  tz: string
): Promise<ActivityCalendar> => {
  const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
  const start = localDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
  // Local midnight of the first day, as the UTC wall-clock time the columns hold,
  // so the first square counts its whole day (and the indexes stay usable)
  const since = Prisma.sql`((${start}::date::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC')`;
  const voiceMember = userId ? Prisma.sql`AND member_id = ${userId}` : Prisma.empty;
  const messageMember = userId ? Prisma.sql`AND user_id = ${userId}` : Prisma.empty;

  // Each session is cut into the local days it covers (like voiceHeatmapCells),
  // so a session past midnight counts on both days and one member's day caps at 24 h.
  // shortcut: sessions that started before the first day don't count on it, and DST days
  // are cut in wall-clock time (same as the heatmap); fine for a year-long calendar.
  // GROUP BY position: see localIssuedOn
  const rows = await db.$queryRaw<DayRow[]>`
    WITH voice AS (
      SELECT d AS day,
        (SUM(EXTRACT(EPOCH FROM LEAST(e, d + INTERVAL '1 day') - GREATEST(s, d))) / 60)::int AS minutes
      FROM (
        SELECT ${localIssuedOn(tz)} AS s,
               ((COALESCE(ended_on, ${NOW_UTC}) AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS e
        FROM voice_stats
        WHERE guild_id = ${serverId}
          AND type = ${VOICE_TYPE.VOICE}
          AND issued_on >= ${since}
          ${voiceMember}
      ) spans,
      LATERAL generate_series(date_trunc('day', s), e, INTERVAL '1 day') AS d
      WHERE d < e AND s < e
      GROUP BY 1
    ),
    msgs AS (
      SELECT DATE_TRUNC('day', ${localTime('created_at', tz)}) AS day, COUNT(*)::int AS messages
      FROM message_stats
      WHERE guild_id = ${serverId}
        AND created_at >= ${since}
        ${messageMember}
      GROUP BY 1
    )
    SELECT COALESCE(voice.day, msgs.day) AS day,
      COALESCE(voice.minutes, 0)::int AS minutes,
      COALESCE(msgs.messages, 0)::int AS messages
    FROM voice FULL JOIN msgs ON voice.day = msgs.day
    -- under 30 s of voice rounds to 0 minutes: not an active day
    WHERE COALESCE(voice.minutes, 0) > 0 OR COALESCE(msgs.messages, 0) > 0
    ORDER BY 1
  `;

  // `day` is zone-less wall-clock time read as UTC, so its ISO date is the local date
  const isoDate = (d: Date) => d.toISOString().substring(0, 10);
  return {
    days: rows.map((row) => ({ date: isoDate(row.day), minutes: row.minutes, messages: row.messages })),
    start,
    end: localDate(new Date()),
  };
};
