import axios from 'axios';
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { LoggedUser } from '../../../../db/models';
import { Unauthorized } from '../../../utils/http-error';

export const status: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as LoggedUser;

      res.send({ user });
    } else {
      throw new Unauthorized();
    }
  },
);
