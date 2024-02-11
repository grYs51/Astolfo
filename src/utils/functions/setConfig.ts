import { PrismaClient, guild_configs } from "@prisma/client";
import { Collection } from "discord.js";
import { getDb } from "../../db";
import { client } from "../..";

export const setGuildConfigs = async (prismaClient: PrismaClient) => {
    const configRepo = prismaClient.guild_configs;
      const guildConfigs = await configRepo.findMany();
      const configs = new Collection<string, guild_configs>();
      guildConfigs.forEach((config) => configs.set(config.guild_id, config));

      client.guildConfigs = configs;
      client.dataSource = getDb();
}