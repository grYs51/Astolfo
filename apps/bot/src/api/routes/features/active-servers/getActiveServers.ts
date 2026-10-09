import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { guilds } from '@nx-stolfo/api-interfaces';
import { discordDirectory } from '../../../utils/discord-directory';

type ServerDurationRow = { guild_id: string; duration: number };

export const getActiveServers: RequestHandler<
  unknown,
  guilds | { error: string }
> = asyncHandler(
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
        SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)))::float AS duration
      FROM voice_stats
      WHERE member_id = ${memberId} AND type = 'VOICE'
      GROUP BY guild_id
      ORDER BY duration DESC
    `;

    // Enrich with guild details from Discord (or the mock directory)
    const directory = discordDirectory();
    const servers = rows.map(({ guild_id, duration }) => {
      const guild = directory.guild(guild_id);
      return {
        id: guild_id,
        name: guild?.name,
        icon: guild?.icon,
        totalDuration: duration,
      };
    });

    res.send(servers);
  }
);
