import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';
import { AdminPeople } from '@nx-stolfo/api-interfaces';

type CountsRow = { dau: number; wau: number; mau: number; churned: number };
type SignInRow = { last7d: number; last30d: number; total: number; before_tracking: number };

const TODAY = Prisma.sql`(NOW() AT TIME ZONE 'UTC')::date`;

// Member-days with voice or messages over the last 90 days, across all servers. A voice session
// counts on every day it covers; open ones (ended_on NULL) run to now. VOICE rows only.
const ACTIVITY = Prisma.sql`
  activity AS (
    SELECT member_id, day::date AS day
    FROM voice_stats,
      generate_series(issued_on::date, COALESCE(ended_on, NOW() AT TIME ZONE 'UTC')::date, interval '1 day') AS day
    WHERE type = 'VOICE' AND COALESCE(ended_on, NOW() AT TIME ZONE 'UTC') >= ${TODAY} - 89
    UNION
    SELECT user_id, created_at::date FROM message_stats WHERE created_at >= ${TODAY} - 89
  )`;

export const getAdminPeople: RequestHandler<unknown, AdminPeople> = asyncHandler(
  async (req, res) => {
    const [daily, [counts], firstSeenPerWeek, [signIns], liveWebSessions, hiddenMembers] =
      await Promise.all([
        req.db.$queryRaw<AdminPeople['daily']>`
          WITH ${ACTIVITY}
          SELECT to_char(d, 'YYYY-MM-DD') AS day, COUNT(DISTINCT a.member_id)::int AS members
          FROM generate_series(${TODAY} - 89, ${TODAY}, interval '1 day') d
          LEFT JOIN activity a ON a.day = d
          GROUP BY d
          ORDER BY d`,
        // DAU is today (UTC), WAU and MAU the last 7 and 30 days including today
        req.db.$queryRaw<CountsRow[]>`
          WITH ${ACTIVITY}
          SELECT
            COUNT(DISTINCT member_id) FILTER (WHERE day = ${TODAY})::int AS dau,
            COUNT(DISTINCT member_id) FILTER (WHERE day > ${TODAY} - 7)::int AS wau,
            COUNT(DISTINCT member_id) FILTER (WHERE day > ${TODAY} - 30)::int AS mau,
            (SELECT COUNT(*) FROM (
              SELECT member_id FROM activity WHERE day > ${TODAY} - 60 AND day <= ${TODAY} - 30
              EXCEPT
              SELECT member_id FROM activity WHERE day > ${TODAY} - 30
            ) c)::int AS churned
          FROM activity`,
        req.db.$queryRaw<AdminPeople['firstSeenPerWeek']>`
          WITH first_seen AS (
            SELECT member_id, MIN(first_at) AS first_at FROM (
              SELECT member_id, MIN(issued_on) AS first_at FROM voice_stats WHERE type = 'VOICE' GROUP BY member_id
              UNION ALL
              SELECT user_id, MIN(created_at) FROM message_stats GROUP BY user_id
            ) f
            GROUP BY member_id
          )
          SELECT to_char(w, 'YYYY-MM-DD') AS week, COUNT(f.member_id)::int AS members
          FROM generate_series(date_trunc('week', ${TODAY}::timestamp) - interval '12 weeks', ${TODAY}, interval '1 week') w
          LEFT JOIN first_seen f ON date_trunc('week', f.first_at) = w
          GROUP BY w
          ORDER BY w`,
        req.db.$queryRaw<SignInRow[]>`
          SELECT
            COUNT(*) FILTER (WHERE last_login_at >= NOW() AT TIME ZONE 'UTC' - interval '7 days')::int AS last7d,
            COUNT(*) FILTER (WHERE last_login_at >= NOW() AT TIME ZONE 'UTC' - interval '30 days')::int AS last30d,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE last_login_at IS NULL)::int AS before_tracking
          FROM user_session`,
        req.db.session.count({ where: { expiresAt: { gt: new Date() } } }),
        // Anonymous total: counting hidden members doesn't name them
        req.db.userConfigs.count({ where: { privacy_hidden: true } }),
      ]);

    res.send({
      daily,
      ...counts,
      firstSeenPerWeek,
      signIns: {
        last7d: signIns.last7d,
        last30d: signIns.last30d,
        total: signIns.total,
        beforeTracking: signIns.before_tracking,
      },
      liveWebSessions,
      hiddenMembers,
    });
  }
);
