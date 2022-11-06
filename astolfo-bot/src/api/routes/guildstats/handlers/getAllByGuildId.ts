import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { GuildStats } from '../../../../db/models';
import { NotFound } from '../../../utils/http-error';
import { validateIdParam } from '../../schemas';

export const getAllByGuildId: RequestHandler<unknown, GuildStats[]> =
  asyncHandler(async (req, res) => {
    const { id } = req.validate(validateIdParam, 'params');
    
    const stats = await req.db.guildStats.findBy({ guildId: id });

    if (!stats.length) throw new NotFound('Guild stats not found');

    res.status(200).send(stats);
  });
