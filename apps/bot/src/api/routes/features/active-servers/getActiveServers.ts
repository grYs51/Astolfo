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

    // Per-guild voice duration (seconds) in SQL. Servers where the member
    // only chats are listed too (0 s), since they can open those pages as well.
    const rows = await req.db.$queryRaw<ServerDurationRow[]>`
      SELECT guild_id, SUM(duration)::float AS duration
      FROM (
        SELECT guild_id, EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) AS duration
        FROM voice_stats
        WHERE member_id = ${memberId} AND type = 'VOICE'
        UNION ALL
        SELECT DISTINCT guild_id, 0
        FROM message_stats
        WHERE user_id = ${memberId}
      ) activity
      GROUP BY guild_id
      ORDER BY duration DESC
    `;

    // Enrich with guild details from Discord (or the mock directory)
    const directory = discordDirectory();
    // Servers the bot has left would show as nameless cards that 403
    const servers = rows.flatMap(({ guild_id, duration }) => {
      const guild = directory.guild(guild_id);
      return guild
        ? [{ id: guild_id, name: guild.name, icon: guild.icon, totalDuration: duration }]
        : [];
    });

    res.send(servers);
  }
);
