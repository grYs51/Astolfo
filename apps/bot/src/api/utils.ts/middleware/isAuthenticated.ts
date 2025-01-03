import { RequestHandler } from 'express';
import { Unauthorized } from '../http-errors';

export const isAuthenticated: RequestHandler = (req, res, next) =>
  req.user ? next() : next(new Unauthorized('You are not authenticated'));
