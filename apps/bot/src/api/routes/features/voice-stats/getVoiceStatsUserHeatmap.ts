import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';
import { currentClient } from '../../../../db';
import { Prisma } from '@prisma/client';
import { getStartDateForPeriod } from '../helpers';

interface VoiceSession {
  member_id: string;
  issued_on: Date;
  ended_on: Date | null;
}

interface HeatmapDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  value: number; // total minutes
  sessionCount: number;
}

interface HeatmapDataPointWithTracking extends HeatmapDataPoint {
  _duration: number;
}

export const getVoiceStatsUserHeatmap = asyncHandler(
  async (req: Request, res: Response) => {
    const { serverId, userId } = req.params;
    const { period = 'month' } = req.query;

    // 'all' (or unknown) means from the beginning of time
    const startDate = getStartDateForPeriod(period as string) ?? new Date(0);

    // Fetch user's sessions in the period
    const userSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
        member_id: userId,
        issued_on: {
          gte: startDate,
        },
      },
    });

    // Aggregate server-wide heatmap directly in the DB to avoid an
    // unbounded full-table scan into application memory.
    type ServerAggRow = {
      hour: number;
      day_of_week: number;
      total_minutes: number;
      unique_users: bigint;
    };

    const serverAggRaw = await currentClient.$queryRaw<ServerAggRow[]>(
      Prisma.sql`
        SELECT
          EXTRACT(HOUR FROM issued_on)::int        AS hour,
          EXTRACT(DOW  FROM issued_on)::int        AS day_of_week,
          SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) / 60)::int AS total_minutes,
          COUNT(DISTINCT member_id)::bigint         AS unique_users
        FROM voice_stats
        WHERE guild_id = ${serverId}
          AND issued_on >= ${startDate}
          AND ended_on IS NOT NULL
        GROUP BY EXTRACT(HOUR FROM issued_on), EXTRACT(DOW FROM issued_on)
      `
    );

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

    // Helper function to process sessions into heatmap
    const processSessionsToHeatmap = (sessions: VoiceSession[]) => {
      const heatmapMap = new Map<string, HeatmapDataPointWithTracking>();

      sessions.forEach((session) => {
        if (!session.ended_on) return; // Skip active sessions

        const startTime = new Date(session.issued_on);
        const endTime = new Date(session.ended_on);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / 1000 / 60);

        // Get hour and day of week from start time
        const hour = startTime.getHours(); // 0-23
        const dayOfWeek = startTime.getDay(); // 0-6 (Sunday-Saturday)
        const key = `${hour}-${dayOfWeek}`;

        const existing = heatmapMap.get(key);
        if (existing) {
          existing.value += durationMinutes;
          existing.sessionCount += 1;
          existing._duration += durationMs;
        } else {
          heatmapMap.set(key, {
            hour,
            dayOfWeek,
            value: durationMinutes,
            sessionCount: 1,
            _duration: durationMs,
          });
        }
      });

      return Array.from(heatmapMap.values()).map((point) => ({
        hour: point.hour,
        dayOfWeek: point.dayOfWeek,
        value: point.value,
        sessionCount: point.sessionCount,
      }));
    };

    // Process both datasets
    const userHeatmap = processSessionsToHeatmap(userSessions);

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
