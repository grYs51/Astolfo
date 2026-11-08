import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import {
  HeatmapPeriod,
  VoiceStatsHeatmap,
  VoiceStatsHeatmapDataPoint,
} from '@nx-stolfo/api-interfaces';
import { getStartDateForPeriod, getTimeZone } from '../helpers';
import { voiceHeatmapCells } from './heatmap-sql';

export const getVoiceStatsHeatmap = asyncHandler(
  async (req: Request, res: Response<VoiceStatsHeatmap>) => {
    const { serverId } = req.params;
    // Whitelisted: an unknown value used to mean "no lower bound" (a scan of
    // the guild's entire history)
    const rawPeriod = req.query.period;
    const period: HeatmapPeriod =
      rawPeriod === 'week' || rawPeriod === 'year' || rawPeriod === 'all'
        ? rawPeriod
        : 'month';
    const tz = getTimeZone(req.query.tz);

    // 'all' means no lower bound
    const startDate = getStartDateForPeriod(period);

    type HeatmapRow = {
      hour: number;
      day_of_week: number;
      total_minutes: number;
      session_count: bigint;
      unique_users: bigint;
    };

    // Aggregated in SQL: a bounded 168-row result. Hours/days are in the
    // viewer's time zone (same as the user heatmap).
    const rows = await req.db.$queryRaw<HeatmapRow[]>(
      voiceHeatmapCells(serverId, tz, startDate)
    );

    const heatmapData: VoiceStatsHeatmapDataPoint[] = rows.map((row) => ({
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
