import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

export const discordAuth: RequestHandler<unknown, number> = asyncHandler(
  async (req, res) => {
    res.sendStatus(200);
  }
);
