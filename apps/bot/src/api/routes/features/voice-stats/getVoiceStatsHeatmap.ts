import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { currentClient } from '../../../../db';
import { Prisma } from '@prisma/client';
import { getStartDateForPeriod } from '../helpers';

interface HeatmapDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  value: number; // total minutes
  sessionCount: number;
  uniqueUsers: number;
}

export const getVoiceStatsHeatmap = asyncHandler(
  async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const { period = 'month' } = req.query;

    // 'all' (or unknown) means no lower bound
    const startDate = getStartDateForPeriod(period as string);
    const dateFilter = startDate
      ? Prisma.sql`AND issued_on >= ${startDate}`
      : Prisma.empty;

    // Aggregate in the database — bounded 168-row result instead of loading
    // every session of the period into memory. EXTRACT uses the DB timezone,
    // matching the user-heatmap endpoint's server-side aggregation.
    type HeatmapRow = {
      hour: number;
      day_of_week: number;
      total_minutes: number;
      session_count: bigint;
      unique_users: bigint;
    };

    const rows = await currentClient.$queryRaw<HeatmapRow[]>(
      Prisma.sql`
        SELECT
          EXTRACT(HOUR FROM issued_on)::int AS hour,
          EXTRACT(DOW  FROM issued_on)::int AS day_of_week,
          SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) / 60)::int AS total_minutes,
          COUNT(*)::bigint AS session_count,
          COUNT(DISTINCT member_id)::bigint AS unique_users
        FROM voice_stats
        WHERE guild_id = ${serverId}
          AND type = 'VOICE'
          AND ended_on IS NOT NULL
          ${dateFilter}
        GROUP BY EXTRACT(HOUR FROM issued_on), EXTRACT(DOW FROM issued_on)
      `
    );

    const heatmapData: HeatmapDataPoint[] = rows.map((row) => ({
      hour: row.hour,
      dayOfWeek: row.day_of_week,
      value: row.total_minutes,
      sessionCount: Number(row.session_count),
      uniqueUsers: Number(row.unique_users),
    }));

    // Calculate stats
    const totalMinutes = heatmapData.reduce(
      (sum, point) => sum + point.value,
      0
    );
    const maxValue =
      heatmapData.length > 0 ? Math.max(...heatmapData.map((p) => p.value)) : 0;
    const avgValue =
      heatmapData.length > 0 ? totalMinutes / heatmapData.length : 0;

    // Find peak hour
    const peakPoint = heatmapData.reduce((max, point) =>
      point.value > max.value ? point : max
    , heatmapData[0] || { hour: 0, dayOfWeek: 0, value: 0, sessionCount: 0, uniqueUsers: 0 });

    res.json({
      heatmap: heatmapData,
      stats: {
        totalMinutes,
        maxValue,
        avgValue: Math.round(avgValue),
        peakHour: peakPoint.hour,
        peakDay: peakPoint.dayOfWeek,
        totalCells: heatmapData.length,
      },
    });
  }
);
