import { ErrorRequestHandler } from 'express';
import { HttpError } from '../http-errors';
import { Logger } from '../../../utils/logger';

/**
 * Final JSON error middleware. Without it Express's default handler returns
 * an HTML stack trace and ignores the status on thrown HttpErrors.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res
      .status(err.statusCode)
      .json({ error: err.message || err.statusText });
    return;
  }

  // Framework errors (body-parser, express-session, …) carry their own 4xx
  // status — a malformed request isn't a server error
  const status = err?.status ?? err?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: err.message || 'Bad Request' });
    return;
  }

  Logger.error(`Unhandled API error on ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'Internal Server Error' });
};
