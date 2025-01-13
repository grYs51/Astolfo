import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

export const signOut: RequestHandler<unknown, undefined> = asyncHandler(
  async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect(process.env.CLIENT_URL);
    });
  }
);
