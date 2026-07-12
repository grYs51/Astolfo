import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { client } from '../../..';

/**
 * Verifies that the authenticated user is currently a member of the guild
 * in `req.params.serverId`, using the Discord cache first and falling back
 * to a gateway fetch. Replaces the per-handler `voice_stats` lookup, which
 * 403'd members who never joined a voice channel and kept granting access
 * to users who left the server.
 */
export const isServerMember: RequestHandler<{ serverId: string }> =
  asyncHandler(async (req, res, next) => {
    const { serverId } = req.params;
    const userId = req.user?.id;

    if (!serverId) {
      res.status(400).json({ error: 'Missing serverId' });
      return;
    }
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const member =
      guild.members.cache.get(userId) ??
      (await guild.members.fetch(userId).catch(() => null));
    if (!member) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  });
