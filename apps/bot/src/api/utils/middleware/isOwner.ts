import { RequestHandler } from 'express';
import { Forbidden, Unauthorized } from '../http-errors';

/** The bot owner (`OWNER`). Unset (allowed in mock mode) means nobody is. */
export const isOwnerId = (id: string | undefined) =>
  !!id && !!process.env.OWNER && id === process.env.OWNER;

/** Locks the /admin routes to the bot owner. The web guard only hides the page. */
export const isOwner: RequestHandler = (req, res, next) => {
  if (!req.user) return next(new Unauthorized('You are not authenticated'));
  if (!isOwnerId(req.user.id)) return next(new Forbidden());
  next();
};
