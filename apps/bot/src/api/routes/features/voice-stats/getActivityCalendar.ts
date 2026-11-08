import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { ActivityCalendar } from '@nx-stolfo/api-interfaces';
import { Prisma } from '@prisma/client';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { getTimeZone, isHiddenFrom, localIssuedOn, localTime } from '../helpers';

type DayRow = { day: Date; minutes: number; messages: number };

/**
 * Daily voice minutes and messages over the last 12 months, for the whole
 * server (`/:serverId/calendar`) or one member (`/:serverId/users/:userId/calendar`).
 * Days are in the viewer's time zone.
 */
export const getActivityCalendar = asyncHandler(
  async (req: Request, res: Response<ActivityCalendar | { error: string }>) => {
    const { serverId, userId } = req.params;
    if (userId && (await isHiddenFrom(req.db, userId, req.user?.id ?? ''))) {
      res.status(403).send({ error: 'private' });
      return;
    }
    const tz = getTimeZone(req.query.tz);
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const voiceMember = userId ? Prisma.sql`AND member_id = ${userId}` : Prisma.empty;
    const messageMember = userId ? Prisma.sql`AND user_id = ${userId}` : Prisma.empty;

    // GROUP BY position: see localIssuedOn
    const rows = await req.db.$queryRaw<DayRow[]>`
      WITH voice AS (
        SELECT DATE_TRUNC('day', ${localIssuedOn(tz)}) AS day,
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) / 60)::int AS minutes
        FROM voice_stats
        WHERE guild_id = ${serverId}
          AND type = ${VOICE_TYPE.VOICE}
          AND issued_on >= ${startDate}
          ${voiceMember}
        GROUP BY 1
      ),
      msgs AS (
        SELECT DATE_TRUNC('day', ${localTime('created_at', tz)}) AS day, COUNT(*)::int AS messages
        FROM message_stats
        WHERE guild_id = ${serverId}
          AND created_at >= ${startDate}
          ${messageMember}
        GROUP BY 1
      )
      SELECT COALESCE(voice.day, msgs.day) AS day,
        COALESCE(voice.minutes, 0)::int AS minutes,
        COALESCE(msgs.messages, 0)::int AS messages
      FROM voice FULL JOIN msgs ON voice.day = msgs.day
      ORDER BY 1
    `;

    // `day` is zone-less wall-clock time read as UTC, so its ISO date is the local date
    const isoDate = (d: Date) => d.toISOString().substring(0, 10);
    const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
    res.json({
      days: rows.map((row) => ({ date: isoDate(row.day), minutes: row.minutes, messages: row.messages })),
      start: localDate(startDate),
      end: localDate(new Date()),
    });
  }
);
