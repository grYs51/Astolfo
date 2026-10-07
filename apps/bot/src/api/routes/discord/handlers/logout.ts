import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';

export const signOut: RequestHandler<unknown, undefined> = asyncHandler(
  async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      // 303 so the browser follows the POST with a GET
      res.redirect(303, process.env.CLIENT_URL);
    });
  }
);
