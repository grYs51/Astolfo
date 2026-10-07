import { RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';
import { NotFound, Unauthorized } from '../http-errors';

const matches = (provided: string, expected: string) => {
  const a = new Uint8Array(Buffer.from(provided));
  const b = new Uint8Array(Buffer.from(expected));
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Guards /api/metrics (process/heap stats, command counters) with a bearer
 * token from METRICS_TOKEN. Without the env var the endpoint is disabled
 * rather than public.
 */
export const requireMetricsToken: RequestHandler = (req, res, next) => {
  const expected = process.env.METRICS_TOKEN;
  if (!expected) {
    return next(new NotFound());
  }

  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token || !matches(token, expected)) {
    return next(new Unauthorized('Invalid metrics token'));
  }

  next();
};
