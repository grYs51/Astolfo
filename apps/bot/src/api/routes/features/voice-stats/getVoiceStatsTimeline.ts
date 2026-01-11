import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStatsTimeline: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { serverId } = req.params;

    if (!user || !user.id) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!serverId) {
      res.status(400).send({ error: 'Missing serverId' });
      return;
    }

    // Get granularity from query (hour, day, week)
    const granularity = (req.query.granularity as string) || 'day';
    const period = (req.query.period as string) || 'month'; // day, week, month, year

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch voice sessions within the date range
    const voiceSessions = await req.db.voiceStats.findMany({
      where: {
        guild_id: serverId,
        issued_on: {
          gte: startDate,
        },
      },
      orderBy: {
        issued_on: 'asc',
      },
    });

    // Function to get bucket key based on granularity
    const getBucketKey = (date: Date): string => {
      switch (granularity) {
        case 'hour':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
        case 'day':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate()) / 7)).padStart(2, '0')}`;
        }
        default:
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    };

    // Aggregate sessions into time buckets
    const timelineData = voiceSessions.reduce((acc, session) => {
      const bucket = getBucketKey(session.issued_on);
      const duration = session.ended_on.getTime() - session.issued_on.getTime();

      if (!acc[bucket]) {
        acc[bucket] = {
          timestamp: bucket,
          totalDuration: 0,
          sessionCount: 0,
          uniqueUsers: new Set<string>(),
          uniqueChannels: new Set<string>(),
        };
      }

      acc[bucket].totalDuration += duration;
      acc[bucket].sessionCount += 1;
      acc[bucket].uniqueUsers.add(session.member_id);
      acc[bucket].uniqueChannels.add(session.channel_id);

      return acc;
    }, {} as Record<string, {
      timestamp: string;
      totalDuration: number;
      sessionCount: number;
      uniqueUsers: Set<string>;
      uniqueChannels: Set<string>;
    }>);

    // Format response
    const timeline = Object.values(timelineData)
      .map((bucket) => ({
        timestamp: bucket.timestamp,
        totalDuration: bucket.totalDuration,
        totalDurationHours: Math.floor(bucket.totalDuration / (1000 * 60 * 60)),
        totalDurationMinutes: Math.floor((bucket.totalDuration % (1000 * 60 * 60)) / (1000 * 60)),
        sessionCount: bucket.sessionCount,
        uniqueUsers: bucket.uniqueUsers.size,
        uniqueChannels: bucket.uniqueChannels.size,
        averageSessionDuration: Math.floor(bucket.totalDuration / bucket.sessionCount),
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    res.send({
      timeline,
      period,
      granularity,
      startDate,
      endDate: now,
    });
  });
