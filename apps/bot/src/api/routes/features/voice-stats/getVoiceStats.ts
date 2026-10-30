import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { VoiceStatsItem, VoiceStatsResponse } from '@nx-stolfo/api-interfaces';
import { hiddenMemberIds } from '../../../../utils/privacy';

export const getVoiceStats: RequestHandler<{ serverId: string }, VoiceStatsResponse> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;

    // Basic pagination params
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    // Rows name their member, so members hiding from the viewer are left out
    const hidden = await hiddenMemberIds(req.db);
    hidden.delete(req.user?.id ?? '');
    const where = { guild_id: serverId, member_id: { notIn: [...hidden] } };

    // Count and page in parallel; stable ordering so pages don't repeat/skip rows
    const [total, items] = await Promise.all([
      req.db.voiceStats.count({ where }),
      req.db.voiceStats.findMany({
        where,
        orderBy: { issued_on: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    // Return a stable DTO shape
    res.send({ items: items as VoiceStatsItem[], total, limit, offset });
  });
