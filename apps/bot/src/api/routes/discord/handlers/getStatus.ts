import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { Logger } from '../../../../utils/logger';

export const getStatus: RequestHandler<unknown, unknown> = asyncHandler(
  async (req, res) => {
    const accessToken = req.user?.access_token;
    if (!accessToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // Don't forward Discord errors (401/429/…) as a 200 with an error body
    if (!response.ok) {
      Logger.warn(
        `Discord /users/@me returned ${response.status} ${response.statusText}`
      );
      res
        .status(response.status)
        .json({ error: 'Failed to fetch Discord profile' });
      return;
    }
    const data = await response.json();
    res.send(data);
  }
);
