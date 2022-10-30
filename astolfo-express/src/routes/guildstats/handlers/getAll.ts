import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { GuildStats } from '../../../db/models';


export const getAll: RequestHandler<unknown, GuildStats[]> = asyncHandler(async (req, res) => {
  // search params
  const { guildid: guildId } = req.query;

  const id = guildId as string;

  // get the guild stats from the db
  const stats = await req.db.guildStats.find({ where: { guildId: id } }) || [];

  res.status(200).send(stats);
});
