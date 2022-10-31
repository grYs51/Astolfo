import axios from 'axios';
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { LoggedUser } from '../../../../db/models';

export const status: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    if (req.isAuthenticated()) {
      const { accessToken } = req.user as LoggedUser;
      const user = await axios
        .get('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        .then((response) => response.data)
        .catch(req.log.error);
      res.send({ user });
    } else {
      res.send({ user: null });
    }
  },
);
