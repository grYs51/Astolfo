import asyncHandler from 'express-async-handler';
import type { Request, Response } from 'express';

interface HeatmapDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  value: number; // total minutes
  sessionCount: number;
  uniqueUsers: number;
}

interface HeatmapDataPointWithUsers extends HeatmapDataPoint {
  _users: string[];
}

export const getVoiceStatsHeatmap = asyncHandler(
  async (req: Request, res: Response) => {
    const { serverId } = req.params;
    const { period = 'month' } = req.query;

    const isMember = await req.db.voiceStats.findFirst({
      where: { guild_id: serverId, member_id: req.user?.id ?? '' },
      select: { id: true },
    });
    if (!isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

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

    // Fetch all sessions in the period
    const sessions = await req.db.voiceStats.findMany({
      where: {
        type: 'VOICE',
        guild_id: serverId,
        issued_on: {
          gte: startDate,
        },
      },
      select: {
        member_id: true,
        issued_on: true,
        ended_on: true,
      },
    });

    // Create a map for aggregation: "hour-dayOfWeek" -> data
    const heatmapMap = new Map<string, HeatmapDataPointWithUsers>();

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
        // Track unique users
        const users = new Set<string>(existing._users);
        users.add(session.member_id);
        existing._users = Array.from(users);
        existing.uniqueUsers = users.size;
      } else {
        heatmapMap.set(key, {
          hour,
          dayOfWeek,
          value: durationMinutes,
          sessionCount: 1,
          uniqueUsers: 1,
          _users: [session.member_id],
        });
      }
    });

    // Convert map to array and remove temporary _users property
    const heatmapData: HeatmapDataPoint[] = Array.from(
      heatmapMap.values()
    ).map(({ _users: _, ...clean }) => clean);

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
