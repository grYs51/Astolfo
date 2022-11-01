import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

export const signOut: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('http://localhost:4200');
    });
  },
);
