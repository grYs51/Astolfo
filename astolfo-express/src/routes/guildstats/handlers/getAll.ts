import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { GuildStatsDTO } from '../resources';
import { mapDbGuildStatsToGuildStatsDTO } from '../mappers';

export const getAll: RequestHandler<unknown, GuildStatsDTO[]> = asyncHandler(async (req, res) => {
  const stats = await req.db.guildStats.find({}).toArray();

  const reply = stats.map(mapDbGuildStatsToGuildStatsDTO);

  res.status(200).send(reply);
});
