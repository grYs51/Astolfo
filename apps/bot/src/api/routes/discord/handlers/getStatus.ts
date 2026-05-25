import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { User } from 'discord.js';

export const getStatus: RequestHandler<unknown, User> = asyncHandler(
  async (req, res) => {
    const { user } = req;
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${user!.access_token}`,
      },
    });
    const data = await response.json();
    res.send(data);
  }
);
