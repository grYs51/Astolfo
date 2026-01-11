import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getVoiceStats: RequestHandler<{ serverId: string }, unknown> =
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

    // const userId = user.id as string; // reserved for filtering when model fields are confirmed

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    // Prisma-style where clause: filter by server and user
    // TODO: add model-aware filtering once field names are confirmed

    // Count total rows (adjust filtering when model fields are confirmed)
    const total = await req.db.voiceStats.count();

    // Fetch paginated items (add filtering when model fields are confirmed)
    const items = await req.db.voiceStats.findMany({
      skip: offset,
      take: limit,
    });

    // Return a stable DTO shape
    res.send({ items, total, limit, offset });
  });
