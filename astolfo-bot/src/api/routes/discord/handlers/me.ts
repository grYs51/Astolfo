import axios from 'axios';
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { LoggedUser } from '../../../../db/models';

export const me: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    const user = req.user as LoggedUser;
    const data = await axios
      .get(`https://discord.com/api/users/@me`, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      })
      .then((response) => response.data);
    res.send(data);
  },
);
