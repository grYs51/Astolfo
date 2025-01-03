import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import {client} from '../../../..';
import { User } from 'discord.js';

export const getStatus: RequestHandler<unknown, User> = asyncHandler(
  async (req, res) => {
    const { user } = req;
    const discordUser = client.users.cache.get(user.id  );
    res.send(discordUser);
  }
);
