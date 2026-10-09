import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import {
  TimelinePeriod,
  VoiceStatsTimeline,
} from '@nx-stolfo/api-interfaces';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import {
  getStartDateForPeriod,
  getTimeZone,
  localIssuedOn,
  parsePeriod,
  toDurationParts,
} from '../helpers';

type TimelineRow = {
  bucket: Date;
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
  unique_channels: bigint;
};

export const getVoiceStatsTimeline: RequestHandler<{ serverId: string }, VoiceStatsTimeline> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Narrow query params to the DTO unions (also whitelists the DATE_TRUNC
    // unit before it reaches SQL)
    const rawGranularity = req.query.granularity as string | undefined;
    const granularity: VoiceStatsTimeline['granularity'] =
      rawGranularity === 'hour' || rawGranularity === 'week' ? rawGranularity : 'day';
    const period: TimelinePeriod = parsePeriod(
      req.query.period,
      ['day', 'week', 'month', 'year', 'all'],
      'month'
    );

    const now = new Date();
    // 'all' starts at the guild's first voice session (not at the epoch, which
    // would generate decades of empty buckets)
    const startDate =
      period === 'all'
        ? (
            await req.db.$queryRaw<{ first: Date | null }[]>`
              SELECT MIN(issued_on) AS first FROM voice_stats
              WHERE guild_id = ${serverId} AND type = ${VOICE_TYPE.VOICE}
            `
          )[0]?.first ?? getStartDateForPeriod('month')!
        : getStartDateForPeriod(period)!;

    const pgGranularity = granularity;
    // Buckets are hours/days/weeks of the viewer's time zone, not UTC
    const tz = getTimeZone(req.query.tz);
    const local = localIssuedOn(tz);

    // DATE_TRUNC bucketing in SQL — no full table scan into memory. Every
    // bucket from the period start to now is returned (generate_series), so
    // quiet days show up as zero instead of the chart silently skipping them.
    // GROUP BY position: see localIssuedOn.
    const rows = await req.db.$queryRaw<TimelineRow[]>`
      WITH agg AS (
        SELECT
          DATE_TRUNC(${pgGranularity}, ${local}) AS bucket,
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS total_duration,
          COUNT(*)::bigint AS session_count,
          COUNT(DISTINCT member_id)::bigint AS unique_users,
          COUNT(DISTINCT channel_id)::bigint AS unique_channels
        FROM voice_stats
        WHERE guild_id = ${serverId}
          AND type = ${VOICE_TYPE.VOICE}
          AND issued_on >= ${startDate}
        GROUP BY 1
      ),
      buckets AS (
        SELECT generate_series(
          DATE_TRUNC(${pgGranularity}, ${startDate}::timestamptz AT TIME ZONE ${tz}),
          DATE_TRUNC(${pgGranularity}, NOW() AT TIME ZONE ${tz}),
          ${`1 ${pgGranularity}`}::interval
        ) AS bucket
      )
      SELECT
        buckets.bucket,
        COALESCE(agg.total_duration, 0)::bigint AS total_duration,
        COALESCE(agg.session_count, 0)::bigint AS session_count,
        COALESCE(agg.unique_users, 0)::bigint AS unique_users,
        COALESCE(agg.unique_channels, 0)::bigint AS unique_channels
      FROM buckets
      LEFT JOIN agg ON agg.bucket = buckets.bucket
      ORDER BY buckets.bucket ASC
    `;

    const timeline = rows.map((row) => {
      const totalDuration = Number(row.total_duration);
      const sessionCount = Number(row.session_count);
      const parts = toDurationParts(totalDuration);
      // bucket is a zone-less wall-clock time, which Prisma reads as UTC — so
      // the ISO string's date/time parts are the local wall-clock values
      const isoStr = row.bucket.toISOString();
      const timestamp = granularity === 'hour' ? isoStr.substring(0, 16) : isoStr.substring(0, 10);
      return {
        timestamp,
        totalDuration,
        totalDurationHours: parts.hours,
        totalDurationMinutes: parts.minutes,
        sessionCount,
        uniqueUsers: Number(row.unique_users),
        uniqueChannels: Number(row.unique_channels),
        averageSessionDuration: sessionCount > 0 ? Math.floor(totalDuration / sessionCount) : 0,
      };
    });

    res.send({
      timeline,
      period,
      granularity,
      startDate,
      endDate: now,
    });
  });
