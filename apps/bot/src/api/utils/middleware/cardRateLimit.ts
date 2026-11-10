import rateLimit from 'express-rate-limit';

/**
 * Card PNGs are the API's most expensive GETs (summary queries, avatar fetches, a resvg render),
 * so on top of the global per-IP limit each user gets 30 a minute: enough for the dashboard preview,
 * which renders again when the viewer changes the theme or sections. Mount after isAuthenticated.
 */
export const cardRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id),
});
