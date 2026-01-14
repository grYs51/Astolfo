import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';

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

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

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

    // Fetch all server sessions for comparison
    const allSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
        issued_on: {
          gte: startDate,
        },
      },
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
    const serverHeatmap = processSessionsToHeatmap(allSessions);

    // Create server average map for quick lookup
    const serverMap = new Map<string, HeatmapDataPoint>();
    serverHeatmap.forEach((point) => {
      serverMap.set(`${point.hour}-${point.dayOfWeek}`, point);
    });

    // Calculate total unique users for server average
    const uniqueUsers = new Set(allSessions.map(s => s.member_id)).size;

    // Build comparison data
    const comparisonData = userHeatmap.map((userPoint) => {
      const key = `${userPoint.hour}-${userPoint.dayOfWeek}`;
      const serverPoint = serverMap.get(key);
      const serverAverage = serverPoint ? Math.round(serverPoint.value / uniqueUsers) : 0;
      const serverTotal = serverPoint?.value || 0;

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

    // Calculate server average stats
    const serverTotalMinutes = serverHeatmap.reduce((sum, point) => sum + point.value, 0);
    const serverAvgPerUser = uniqueUsers > 0 ? Math.round(serverTotalMinutes / uniqueUsers) : 0;

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
          totalUsers: uniqueUsers,
        },
        comparison: {
          userVsServerAvg: serverAvgPerUser > 0 ? Math.round((userTotalMinutes / serverAvgPerUser) * 100) : 0,
          aboveAverage: userTotalMinutes > serverAvgPerUser,
        },
      },
    });
  }
);
