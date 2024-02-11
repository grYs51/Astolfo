import { PrismaClient, guild_configs, user_configs } from '@prisma/client';
import { Collection } from 'discord.js';
import { getDb } from '../../db';
import { client } from '../..';

export const setConfigs = async (prismaClient: PrismaClient) => {
  // guilds
  const guildConfigs = await prismaClient.guild_configs.findMany();
  const guildConfigCollection = new Collection<string, guild_configs>();
  guildConfigs.forEach((config) =>
    guildConfigCollection.set(config.guild_id, config),
  );

  // users
  const userConfigs = await prismaClient.user_configs.findMany();
  const userConfigsCollection = new Collection<string, user_configs>();
  userConfigs.forEach((config) =>
    userConfigsCollection.set(config.user_id, config),
  );

  client.guildConfigs = guildConfigCollection;
  client.userConfigs = userConfigsCollection;

  client.dataSource = getDb();
};
