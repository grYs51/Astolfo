import { client } from '../../client/instance';
import DiscordClient from '../../client/client';
import { guild_configs } from '@prisma/client';
import { getDb } from '../../db';
import { Logger } from '../logger';

/** Prefix for new guilds; `||` because compose passes an unset variable as '' */
export const defaultPrefix = () => process.env.DEFAULT_PREFIX || ',';

export const setConfigs = async () => {
  const prismaClient = getDb();
  Logger.info('Setting configurations...');

  // guilds
  const guildConfigs = await prismaClient.guildConfigurations.findMany();
  guildConfigs.forEach((config) =>
    client.guildConfigs.set(config.guild_id, config)
  );

  // users
  const userConfigs = await prismaClient.userConfigs.findMany();
  userConfigs.forEach((config) =>
    client.userConfigs.set(config.user_id, config)
  );

  client.dataSource = prismaClient;
};

/** Logs a join or leave for the admin page; a failure never blocks the caller */
export const recordGuildEvent = (
  discord: DiscordClient,
  guildId: string,
  type: 'join' | 'leave',
  at = new Date()
) =>
  discord.dataSource.guildEvents
    .create({ data: { guild_id: guildId, type, at } })
    .catch((error) => Logger.error(`Failed to record guild ${type} for ${guildId}`, error));

/**
 * Upserts a guild's config and updates `client.guildConfigs`, so the bot sees
 * the change at once. New code writes guild_configs through this.
 */
export const saveGuildConfig = async (
  discord: DiscordClient,
  guildId: string,
  data: Partial<Omit<guild_configs, 'guild_id'>>
) => {
  const updated = await discord.dataSource.guildConfigurations.upsert({
    where: { guild_id: guildId },
    update: data,
    create: { guild_id: guildId, ...data },
  });
  discord.guildConfigs.set(guildId, updated);
  return updated;
};

/** Digest channel change; turning it on starts with next Monday's recap, not a catch-up post now */
export const digestChannelUpdate = (
  config: { digest_channel_id: string | null } | undefined,
  channelId: string | null
): { digest_channel_id: string | null; digest_last_sent_at?: Date } =>
  channelId && !config?.digest_channel_id
    ? { digest_channel_id: channelId, digest_last_sent_at: new Date() }
    : { digest_channel_id: channelId };

export const checkForNewGuilds = async () => {
  const prismaClient = getDb();
  // for…of so the caller can await completion and errors aren't swallowed
  // (forEach(async …) fires and forgets)
  for (const guild of client.guilds.cache.values()) {
    if (client.guildConfigs.has(guild.id)) continue;

    Logger.info(`I found a new guild! ${guild.id}, adding...`);
    client.guildConfigs.set(guild.id, {
      guild_id: guild.id,
      prefix: defaultPrefix(),
      welcome_channel_id: null,
      welcome_message: '',
      goodbye_message: '',
      toggles: 0,
      digest_channel_id: null,
      digest_last_sent_at: null,
    });
    await prismaClient.guildConfigurations.create({
      data: {
        guild_id: guild.id,
        prefix: defaultPrefix(),
        welcome_channel_id: null,
        welcome_message: '',
        goodbye_message: '',
      },
    });
    // Joined while the bot was offline (GuildCreate only fires once ready)
    await recordGuildEvent(client, guild.id, 'join', guild.joinedAt ?? new Date());
  }
};
