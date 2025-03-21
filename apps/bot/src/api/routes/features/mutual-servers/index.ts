import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';

export const getActiveServers: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {



    const { user } = req;

    const { id } = user;

    try {
      // get all unique servers the user has stats in
      const uniqueServerids = await req.db.voiceStats.findMany({
        where: { member_id: id },
        distinct: ['guild_id'],
        select: { guild_id: true },
      });

      const uniqueServers = uniqueServerids.map((server) => {
        const guild = client.guilds.cache.get(server.guild_id);

        return {
          id: server.guild_id,
          name: guild?.name,
          icon: guild?.iconURL(),
          memberCount: guild?.memberCount,
        };
      });

      res.send(uniqueServers);
    } catch (error) {
      res.status(500).send(error);
    }
  }
);
