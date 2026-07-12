import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';

type ServerDurationRow = { guild_id: string; duration: number };

export const getActiveServers: RequestHandler<unknown, unknown> = asyncHandler(
  async (req, res) => {
    const memberId = req.user?.id;
    if (!memberId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Aggregate per-guild duration (seconds) in SQL — no full row scan into memory
    const rows = await req.db.$queryRaw<ServerDurationRow[]>`
      SELECT
        guild_id,
        SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)))::float AS duration
      FROM voice_stats
      WHERE member_id = ${memberId} AND type = 'VOICE'
      GROUP BY guild_id
      ORDER BY duration DESC
    `;

    // Enrich with guild details from the Discord cache
    const servers = rows.map(({ guild_id, duration }) => {
      const guild = client.guilds.cache.get(guild_id);
      return {
        id: guild_id,
        name: guild?.name,
        icon: guild?.iconURL(),
        totalDuration: duration,
      };
    });

    res.send(servers);
  }
);
