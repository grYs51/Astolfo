import { PrismaClient } from '@prisma/client';
import { client } from '../..';
import { getDb } from '../../db';

export const setConfigs = async (prismaClient: PrismaClient) => {
  const guildConfigs = await prismaClient.guild_configs.findMany();
  guildConfigs.forEach((config) =>
    client.guildConfigs.set(config.guild_id, config),
  );

  // users
  const userConfigs = await prismaClient.user_configs.findMany()
  userConfigs.forEach((config) =>
    client.userConfigs.set(config.user_id, config),
  );

  client.dataSource = getDb();
};
