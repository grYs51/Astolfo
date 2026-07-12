import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStats: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    // Count and page in parallel; stable ordering so pages don't repeat/skip rows
    const [total, items] = await Promise.all([
      req.db.voiceStats.count({
        where: { guild_id: serverId },
      }),
      req.db.voiceStats.findMany({
        where: { guild_id: serverId },
        orderBy: { issued_on: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    // Return a stable DTO shape
    res.send({ items, total, limit, offset });
  });
