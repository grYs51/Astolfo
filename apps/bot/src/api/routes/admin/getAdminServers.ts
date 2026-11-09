import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { AdminServers } from '@nx-stolfo/api-interfaces';
import { discordDirectory } from '../../utils/discord-directory';
import {
  isEnabled,
  SETTING_FLAGS,
  SETTINGS_LABELS,
  Settings,
} from '../../../utils/handlers/settings-handler';

type ActivityRow = {
  guild_id: string;
  voice_ms: number;
  messages: number;
  last_at: Date | null;
};
type WeekRow = { week: string; joins: number; leaves: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export const getAdminServers: RequestHandler<unknown, AdminServers> = asyncHandler(
  async (req, res) => {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [activity, weeks, configs] = await Promise.all([
      // VOICE rows only (the other types overlap them); open sessions count live time, clipped to the window
      req.db.$queryRaw<ActivityRow[]>`
        SELECT guild_id, SUM(voice_ms)::float AS voice_ms, SUM(messages)::int AS messages, MAX(last_at) AS last_at
        FROM (
          SELECT guild_id,
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - GREATEST(issued_on, ${since}))) * 1000)
              FILTER (WHERE COALESCE(ended_on, NOW()) > ${since}), 0) AS voice_ms,
            0 AS messages,
            MAX(COALESCE(ended_on, NOW())) AS last_at
          FROM voice_stats
          WHERE type = 'VOICE'
          GROUP BY guild_id
          UNION ALL
          SELECT guild_id, 0, COUNT(*) FILTER (WHERE created_at >= ${since}), MAX(created_at)
          FROM message_stats
          GROUP BY guild_id
        ) t
        GROUP BY guild_id`,
      req.db.$queryRaw<WeekRow[]>`
        SELECT to_char(date_trunc('week', at), 'YYYY-MM-DD') AS week,
          COUNT(*) FILTER (WHERE type = 'join')::int AS joins,
          COUNT(*) FILTER (WHERE type = 'leave')::int AS leaves
        FROM guild_events
        GROUP BY 1
        ORDER BY 1`,
      req.db.guildConfigurations.findMany({
        select: { guild_id: true, toggles: true, digest_channel_id: true },
      }),
    ]);

    const byGuild = new Map(activity.map((row) => [row.guild_id, row]));
    const configByGuild = new Map(configs.map((config) => [config.guild_id, config]));
    const settings = Object.keys(SETTING_FLAGS) as Settings[];

    const servers = discordDirectory()
      .guilds()
      .map((guild) => {
        const row = byGuild.get(guild.id);
        const config = configByGuild.get(guild.id);
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          memberCount: guild.memberCount,
          joinedAt: guild.joinedAt?.toISOString() ?? null,
          voiceHours30d: Math.round(((row?.voice_ms ?? 0) / 3_600_000) * 10) / 10,
          messages30d: row?.messages ?? 0,
          lastActivity: row?.last_at?.toISOString() ?? null,
          toggles: settings
            .filter((key) => isEnabled(config?.toggles ?? 0, SETTING_FLAGS[key]))
            .map((key) => SETTINGS_LABELS[key]),
          digest: !!config?.digest_channel_id,
        };
      });

    res.send({ servers, joinsPerWeek: weeks });
  }
);
