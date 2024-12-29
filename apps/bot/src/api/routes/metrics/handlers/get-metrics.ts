import { RequestHandler } from 'express';
import { register } from 'prom-client';

export const getMetrics: RequestHandler = async (req, res) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
};
