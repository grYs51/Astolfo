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

  // users
  const userConfigs = await prismaClient.userConfigs.findMany();
  userConfigs.forEach((config) =>
    client.userConfigs.set(config.user_id, config)
  );

  client.dataSource = prismaClient;
};

export const checkForNewGuilds = async () => {
  const prismaClient = getDb();
  const guilds = client.guilds.cache;
  guilds.forEach(async (guild) => {
    if (!client.guildConfigs.has(guild.id)) {
      logger.info(`I found a new guild! ${guild.id}, adding...`);
      client.guildConfigs.set(guild.id, {
        guild_id: guild.id,
        prefix: process.env.DEFAULT_PREFIX ?? ',',
        welcome_channel_id: null,
        welcome_message: '',
        goodbye_message: '',
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
  });
};
