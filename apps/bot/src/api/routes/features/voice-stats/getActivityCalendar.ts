import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { ActivityCalendar } from '@nx-stolfo/api-interfaces';
import { getTimeZone } from '../helpers';
import { activityCalendar } from './calendar-sql';

/**
 * Daily voice minutes and messages over the last 12 months, for the whole
 * server (`/:serverId/calendar`) or one member (`/:serverId/users/:userId/calendar`).
 * Days are in the viewer's time zone.
 */
export const getActivityCalendar = asyncHandler(
  async (req: Request, res: Response<ActivityCalendar>) => {
    const { serverId, userId } = req.params;
    res.json(await activityCalendar(req.db, serverId, userId, getTimeZone(req.query.tz)));
  }
);
