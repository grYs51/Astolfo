import { RequestHandler } from 'express';
import { AuthUser } from '@nx-stolfo/api-interfaces';

/** The profile saved at login (behind isAuthenticated); no call to Discord. */
export const getStatus: RequestHandler<unknown, AuthUser> = (req, res) => {
  const { id, username, global_name, avatar } = req.user as AuthUser;
  res.send({ id, username, global_name, avatar });
};
