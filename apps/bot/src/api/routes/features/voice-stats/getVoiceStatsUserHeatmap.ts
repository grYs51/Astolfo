import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { HeatmapPeriod, VoiceStatsUserHeatmap } from '@nx-stolfo/api-interfaces';
import { Prisma } from '@prisma/client';
import { VOICE_TYPE } from '../../../../utils/handlers/vc';
import { getStartDateForPeriod, getTimeZone, localIssuedOn } from '../helpers';

type HeatmapCellRow = {
  hour: number; // 0-23
  day_of_week: number; // 0-6 (Sunday-Saturday)
  total_minutes: number;
  session_count: bigint;
  unique_users: bigint;
};

export const getVoiceStatsUserHeatmap = asyncHandler(
  async (req: Request, res: Response<VoiceStatsUserHeatmap>) => {
    const { serverId, userId } = req.params;
    const rawPeriod = req.query.period;
    const period: HeatmapPeriod =
      rawPeriod === 'week' || rawPeriod === 'year' || rawPeriod === 'all'
        ? rawPeriod
        : 'month';

    // 'all' means from the beginning of time
    const startDate = getStartDateForPeriod(period) ?? new Date(0);
    const local = localIssuedOn(getTimeZone(req.query.tz));

    // User and server cells come from the same SQL aggregation, so both sides
    // bucket by the same hour/day (in the viewer's time zone) and round the
    // same way. Only VOICE rows count (MUTED/DEAF/... overlap them); open
    // sessions count live.
    const heatmapCells = (memberFilter: Prisma.Sql) =>
      req.db.$queryRaw<HeatmapCellRow[]>(
        Prisma.sql`
          SELECT
            EXTRACT(HOUR FROM ${local})::int         AS hour,
            EXTRACT(DOW  FROM ${local})::int         AS day_of_week,
            SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) / 60)::int AS total_minutes,
            COUNT(*)::bigint                          AS session_count,
            COUNT(DISTINCT member_id)::bigint         AS unique_users
          FROM voice_stats
          WHERE guild_id = ${serverId}
            AND type = ${VOICE_TYPE.VOICE}
            AND issued_on >= ${startDate}
            ${memberFilter}
          GROUP BY 1, 2
        `
      );

    const [userRows, serverAggRaw] = await Promise.all([
      heatmapCells(Prisma.sql`AND member_id = ${userId}`),
      heatmapCells(Prisma.empty),
    ]);

    // Build a lookup map for the server aggregation
    const serverMap = new Map<string, { totalMinutes: number; uniqueUsers: number }>();
    let serverTotalMinutes = 0;
    let serverTotalUsers = 0;

    serverAggRaw.forEach((row) => {
      const key = `${row.hour}-${row.day_of_week}`;
      serverMap.set(key, { totalMinutes: row.total_minutes, uniqueUsers: Number(row.unique_users) });
      serverTotalMinutes += row.total_minutes;
      // Unique users across cells isn't additive — use max as rough measure
      serverTotalUsers = Math.max(serverTotalUsers, Number(row.unique_users));
    });

    const userHeatmap = userRows.map((row) => ({
      hour: row.hour,
      dayOfWeek: row.day_of_week,
      value: row.total_minutes,
      sessionCount: Number(row.session_count),
    }));

    // Build comparison data using the pre-aggregated server map
    const comparisonData = userHeatmap.map((userPoint) => {
      const key = `${userPoint.hour}-${userPoint.dayOfWeek}`;
      const serverPoint = serverMap.get(key);
      const serverAverage = serverPoint && serverPoint.uniqueUsers > 0
        ? Math.round(serverPoint.totalMinutes / serverPoint.uniqueUsers)
        : 0;
      const serverTotal = serverPoint?.totalMinutes || 0;

      return {
        hour: userPoint.hour,
        dayOfWeek: userPoint.dayOfWeek,
        userValue: userPoint.value,
        serverAverage,
        difference: userPoint.value - serverAverage,
        percentageOfServer: serverTotal > 0 ? Math.round((userPoint.value / serverTotal) * 100) : 0,
        sessionCount: userPoint.sessionCount,
      };
    });

    // Calculate user stats
    const userTotalMinutes = userHeatmap.reduce((sum, point) => sum + point.value, 0);
    const userMaxValue = userHeatmap.length > 0 ? Math.max(...userHeatmap.map(p => p.value)) : 0;

    // Server aggregate stats come from the SQL aggregation
    const serverAvgPerUser = serverTotalUsers > 0 ? Math.round(serverTotalMinutes / serverTotalUsers) : 0;

    // Find peak times
    const userPeakPoint = userHeatmap.reduce(
      (max, point) => (point.value > max.value ? point : max),
      userHeatmap[0] || { hour: 0, dayOfWeek: 0, value: 0, sessionCount: 0 }
    );

    res.json({
      userId,
      period,
      userHeatmap: comparisonData,
      stats: {
        user: {
          totalMinutes: userTotalMinutes,
          maxValue: userMaxValue,
          avgValue: userHeatmap.length > 0 ? Math.round(userTotalMinutes / userHeatmap.length) : 0,
          peakHour: userPeakPoint.hour,
          peakDay: userPeakPoint.dayOfWeek,
          totalCells: userHeatmap.length,
        },
        server: {
          totalMinutes: serverTotalMinutes,
          avgPerUser: serverAvgPerUser,
          totalUsers: serverTotalUsers,
        },
        comparison: {
          userVsServerAvg: serverAvgPerUser > 0 ? Math.round((userTotalMinutes / serverAvgPerUser) * 100) : 0,
          aboveAverage: userTotalMinutes > serverAvgPerUser,
        },
      },
    });
  }
);
