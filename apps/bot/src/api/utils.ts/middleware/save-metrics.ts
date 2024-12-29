import { SaveMetrics } from '../save-on-exit';
import { RequestHandler } from 'express';

export const storeMetrics: RequestHandler = async (req, res, next) => {
  await SaveMetrics();
  next();
};
