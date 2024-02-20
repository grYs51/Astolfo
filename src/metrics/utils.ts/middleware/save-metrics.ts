import { register } from 'prom-client';
import { saveToDb } from '../save-on-exit';
import { RequestHandler } from 'express';

export const storeMetrics: RequestHandler = async (req, res, next) => {
  const metrics = await register.metrics();
  await saveToDb(metrics);
  next();
};
