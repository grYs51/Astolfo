import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { GuildStats } from '../../../../db/models';


export const getAll: RequestHandler<unknown, GuildStats[]> = asyncHandler(async (req, res) => {
  const { guildid: guildId } = req.query;

  const id = guildId as string;

  const stats = await req.db.guildStats.findOne({ where: { guildId: id }, });

  if (!stats) {
    res.status(404);
    throw new Error('Guild stats not found');
  }

  
  const test : GuildStats[] = [{
    ...stats,
    guildId: req.discordClient.guilds.cache.get(stats.guildId)?.name || id,
  }];


  res.status(200).send(test);
});
