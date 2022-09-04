import { Guild } from 'discord.js';
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const getList: RequestHandler<unknown, any[]> = asyncHandler(
  async (req, res) => {
    const guilds = req.client.guilds.cache.map((guild: Guild) => {
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        owner: guild.ownerId,
        members: guild.memberCount,
      };
    });

    res.send(guilds);
  },
);
