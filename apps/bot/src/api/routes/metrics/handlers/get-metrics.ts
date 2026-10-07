import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { register } from 'prom-client';

export const getMetrics: RequestHandler = asyncHandler(async (req, res) => {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
});
