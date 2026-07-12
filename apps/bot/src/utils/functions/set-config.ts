import { client } from '../..';
import { getDb } from '../../db';
import { Logger } from '../logger';

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

export const checkForNewGuilds = async () => {
  const prismaClient = getDb();
  // for…of so the caller can await completion and errors aren't swallowed
  // (forEach(async …) fires and forgets)
  for (const guild of client.guilds.cache.values()) {
    if (client.guildConfigs.has(guild.id)) continue;

    Logger.info(`I found a new guild! ${guild.id}, adding...`);
    client.guildConfigs.set(guild.id, {
      guild_id: guild.id,
      prefix: process.env.DEFAULT_PREFIX ?? ',',
      welcome_channel_id: null,
      welcome_message: '',
      goodbye_message: '',
      toggles: 0,
    });
    await prismaClient.guildConfigurations.create({
      data: {
        guild_id: guild.id,
        prefix: process.env.DEFAULT_PREFIX ?? ',',
        welcome_channel_id: null,
        welcome_message: '',
        goodbye_message: '',
      },
    });
  }
};
