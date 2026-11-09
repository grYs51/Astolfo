import { RequestHandler } from 'express';
import { apiRequestDuration, apiRequestsCounter } from '../counter';

/**
 * Counts every API request by route pattern (`/api/features/voice-stats/:serverId/overview`),
 * never the URL, so ids don't fill the labels. `unmatched` for requests no route took.
 */
export const requestMetrics: RequestHandler = (req, res, next) => {
  const endTimer = apiRequestDuration.startTimer();
  let route = 'unmatched';
  let matched: unknown;
  // Express resets req.baseUrl when an error (e.g. a 403) leaves the router,
  // so read it at the moment Express assigns req.route
  Object.defineProperty(req, 'route', {
    configurable: true,
    enumerable: true,
    get: () => matched,
    set: (value: { path: string }) => {
      matched = value;
      route = req.baseUrl + value.path;
    },
  });

  res.on('finish', () => {
    apiRequestsCounter.inc({ method: req.method, route, status: res.statusCode });
    endTimer({ method: req.method, route });
  });
  next();
};
