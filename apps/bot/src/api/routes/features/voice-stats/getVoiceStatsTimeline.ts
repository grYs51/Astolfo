import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import {
  TimelinePeriod,
  VoiceStatsTimeline,
} from '@nx-stolfo/api-interfaces';
import { getStartDateForPeriod, toDurationParts } from '../helpers';

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
    const rawPeriod = req.query.period as string | undefined;
    const period: TimelinePeriod =
      rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'year'
        ? rawPeriod
        : 'month';

    const now = new Date();
    const startDate =
      getStartDateForPeriod(period) ?? getStartDateForPeriod('month')!;

    const pgGranularity = granularity;

    // Single SQL query with DATE_TRUNC bucketing — no full table scan into memory
    const rows = await req.db.$queryRaw<TimelineRow[]>`
      SELECT
        DATE_TRUNC(${pgGranularity}, issued_on) AS bucket,
        SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000)::bigint AS total_duration,
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
