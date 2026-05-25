import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStats: RequestHandler<{ serverId: string }, unknown> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    if (!serverId) {
      res.status(400).send({ error: 'Missing serverId' });
      return;
    }

    const isMember = await req.db.voiceStats.findFirst({
      where: { guild_id: serverId, member_id: req.user?.id ?? '' },
      select: { id: true },
    });
    if (!isMember) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    // Prisma-style where clause: filter by server and user
    // TODO: add model-aware filtering once field names are confirmed

    // Count total rows filtered by server
    const total = await req.db.voiceStats.count({
      where: { guild_id: serverId },
    });

    // Fetch paginated items filtered by server
    const items = await req.db.voiceStats.findMany({
      where: { guild_id: serverId },
      skip: offset,
      take: limit,
    });

    // Return a stable DTO shape
    res.send({ items, total, limit, offset });
  });
