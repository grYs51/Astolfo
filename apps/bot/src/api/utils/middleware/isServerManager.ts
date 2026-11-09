import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { discordDirectory } from '../discord-directory';

/**
 * Verifies that the authenticated user has Manage Server in the guild in
 * `req.params.serverId`. Mount after `isServerMember`. The OAuth tokens
 * aren't stored, so this reads the bot's gateway cache, not the viewer's
 * own Discord permissions.
 */
export const isServerManager: RequestHandler<{ serverId: string }> =
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

    if (!(await discordDirectory().canManage(serverId, userId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  });
