import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

export const discordAuth: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    res.send(200);
  },
);
