import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

export const redirect: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {

    res.send(200);

    // res.redirect('/');
  },
);
