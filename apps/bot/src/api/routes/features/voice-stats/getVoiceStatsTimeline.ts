import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { getStartDateForPeriod, toDurationParts } from '../helpers';

type TimelineRow = {
  bucket: Date;
  total_duration: bigint;
  session_count: bigint;
  unique_users: bigint;
  unique_channels: bigint;
};

// DATE_TRUNC unit must be validated against this whitelist before use in SQL
const VALID_GRANULARITIES: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
};

export const getVoiceStatsTimeline: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Get granularity from query (hour, day, week)
    const granularity = (req.query.granularity as string) || 'day';
    const period = (req.query.period as string) || 'month'; // day, week, month, year

    const now = new Date();
    const startDate =
      getStartDateForPeriod(period) ?? getStartDateForPeriod('month')!;

    // Validate granularity against whitelist to prevent SQL injection
    const pgGranularity = VALID_GRANULARITIES[granularity] ?? 'day';

    // Single SQL query with DATE_TRUNC bucketing — no full table scan into memory
    const rows = await req.db.$queryRaw<TimelineRow[]>`
      SELECT
        DATE_TRUNC(${pgGranularity}, issued_on) AS bucket,
        SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000)::bigint AS total_duration,
        COUNT(*)::bigint AS session_count,
        COUNT(DISTINCT member_id)::bigint AS unique_users,
        COUNT(DISTINCT channel_id)::bigint AS unique_channels
      FROM voice_stats
      WHERE guild_id = ${serverId}
        AND issued_on >= ${startDate}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const timeline = rows.map((row) => {
      const totalDuration = Number(row.total_duration);
      const sessionCount = Number(row.session_count);
      const parts = toDurationParts(totalDuration);
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
