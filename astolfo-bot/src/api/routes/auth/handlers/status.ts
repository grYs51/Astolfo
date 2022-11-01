import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import { LoggedUser } from '../../../../db/models';

export const status :RequestHandler<unknown, LoggedUser> = asyncHandler(
  async (req, res) => {
    const user = req.user as LoggedUser;

    res.send( user );
  }
);