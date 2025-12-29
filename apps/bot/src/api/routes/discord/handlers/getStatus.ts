import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { User } from 'discord.js';

export const getStatus: RequestHandler<unknown, User> = asyncHandler(
  async (req, res) => {
    const { user } = req;
    fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        res.send(data);
      });
  }
);
