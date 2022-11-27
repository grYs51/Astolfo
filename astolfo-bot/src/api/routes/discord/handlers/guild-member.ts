import axios from 'axios';
import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { LoggedUser } from '../../../../db/models';
import { Unauthorized } from '../../../utils/http-error';
import { validateIdParam } from '../../schemas';

export const guildMember: RequestHandler<unknown, any> = asyncHandler(
  async (req, res) => {
    const { id } = req.validate(validateIdParam, 'params');

    const user = req.user as LoggedUser;
    const data = await axios
      .get(`https://discord.com/api/users/@me/guilds/${id}/member`, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      })
      .then((response) => response.data)
      .catch((error) => {
        req.log.error(error);
        throw new Unauthorized(error.message);
      });
    res.send(data);
  },
);
