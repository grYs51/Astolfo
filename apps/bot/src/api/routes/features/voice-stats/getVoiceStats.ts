import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../../..';

export const getVoiceStats: RequestHandler<{ serverId: string }, any> =
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = user;
    const { serverId } = req.params;

    console.log('Server ID:', serverId);

    // Get all voice stats for the user with type from specific server
    const voiceStats = await req.db.voiceStats.findMany({});
    res.send(voiceStats);
  });
