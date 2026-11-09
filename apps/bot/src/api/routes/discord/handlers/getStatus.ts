import { RequestHandler } from 'express';
import { AuthUser } from '@nx-stolfo/api-interfaces';
import { isOwnerId } from '../../../utils/middleware/isOwner';

/** The profile saved at login (behind isAuthenticated); no call to Discord. */
export const getStatus: RequestHandler<unknown, AuthUser> = (req, res) => {
  const { id, username, global_name, avatar } = req.user as Express.User;
  res.send({ id, username, global_name, avatar, isOwner: isOwnerId(id) });
};
