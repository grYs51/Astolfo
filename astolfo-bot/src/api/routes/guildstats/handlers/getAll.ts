import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { GuildStats } from '../../../../db/models';

export const getAll: RequestHandler<unknown, GuildStats[]> = asyncHandler(
  async (req, res) => {
    const stats = await req.db.guildStats.find();

    res.status(200).send(stats);
  },
);
