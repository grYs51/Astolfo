import { client } from '../..';
import { getDb } from '../../db';
import logger from '../logger';

export const setConfigs = async () => {
  const prismaClient = getDb();
  logger.info('Setting configurations...');
  
  // guilds
  const guildConfigs = await prismaClient.guildConfigurations.findMany();
  guildConfigs.forEach((config) =>
    client.guildConfigs.set(config.guild_id, config)
  );

  // check for missing guilds
  const guilds = client.guilds.cache;

  logger.info(guilds.size);

  guilds.forEach((guild) => {
    if (!client.guildConfigs.has(guild.id)) {
      logger.info(`Guild ${guild.id} not found in database, adding...`);
      client.guildConfigs.set(guild.id, {
        guild_id: guild.id,
        prefix: process.env.DEFAULT_PREFIX!,
        welcome_channel_id: null,
        welcome_message: '',
        goodbye_message: '',
      });
    }
  });

  // users
  const userConfigs = await prismaClient.userConfigs.findMany();
  userConfigs.forEach((config) =>
    client.userConfigs.set(config.user_id, config)
  );

  client.dataSource = getDb();
};
