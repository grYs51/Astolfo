import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

// A route pattern (`overview/detail/:id`), never a URL with ids in it
export const PAGE_PATTERN = /^[a-zA-Z0-9/:_-]{1,100}$/; // params are camelCase (:memberId)
// A Discord id (17–20 digits) means a URL was sent instead of the pattern
const HAS_ID = /\d{15,}/;

/** POST /features/track { path } — one dashboard page view for the admin page's Website section */
export const trackPageView: RequestHandler<unknown, { error: string } | undefined, { path?: unknown }> =
  asyncHandler(async (req, res) => {
    const path = req.body?.path;
    if (typeof path !== 'string' || !PAGE_PATTERN.test(path) || HAS_ID.test(path)) {
      res.status(400).send({ error: '`path` must be a route pattern' });
      return;
    }

    await req.db.$executeRaw`
      INSERT INTO page_views (day, path, user_id, views)
      VALUES ((NOW() AT TIME ZONE 'UTC')::date, ${path}, ${req.user.id}, 1)
      ON CONFLICT (day, path, user_id) DO UPDATE SET views = page_views.views + 1`;
    res.status(204).end();
  });
