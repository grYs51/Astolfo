import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

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
    const data = await response.json();
    res.send(data);
  }
);
