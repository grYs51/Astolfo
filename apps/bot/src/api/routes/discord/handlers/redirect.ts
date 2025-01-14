import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const redirect: RequestHandler<unknown, string> = asyncHandler(
  async (req, res) => {
    res.redirect(process.env.CLIENT_URL);
  }
);
