import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { AdminWeb } from '@nx-stolfo/api-interfaces';

type DayRow = { day: string; views: number; visitors: number };
type PageRow = { path: string; views: number; visitors: number };

export const getAdminWeb: RequestHandler<unknown, AdminWeb> = asyncHandler(
  async (req, res) => {
    const [daily, topPages] = await Promise.all([
      req.db.$queryRaw<DayRow[]>`
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
          COALESCE(SUM(p.views), 0)::int AS views,
          COUNT(DISTINCT p.user_id)::int AS visitors
        FROM generate_series((NOW() AT TIME ZONE 'UTC')::date - 89, (NOW() AT TIME ZONE 'UTC')::date, '1 day') d
        LEFT JOIN page_views p ON p.day = d
        GROUP BY d
        ORDER BY d`,
      req.db.$queryRaw<PageRow[]>`
        SELECT path, SUM(views)::int AS views, COUNT(DISTINCT user_id)::int AS visitors
        FROM page_views
        WHERE day > (NOW() AT TIME ZONE 'UTC')::date - 90
        GROUP BY path
        ORDER BY views DESC
        LIMIT 10`,
    ]);
    res.send({ daily, topPages });
  }
);
