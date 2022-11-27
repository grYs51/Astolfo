import { ErrorRequestHandler } from 'express';
import { UnauthorizedError } from 'express-jwt';
import {
  HttpError,
  InternalServerError,
  Unauthorized,
} from '../utils/http-error';
import logger from '../utils/logger';

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    logger.error({ req, err }, 'Error occurred but headers already sent');
    next();
  }

  let httpError: HttpError;

  switch (true) {
    case err instanceof HttpError:
      httpError = err;
      break;
    case err instanceof UnauthorizedError:
      httpError = new Unauthorized(err.message);
      break;
    default:
      httpError = new InternalServerError();
      break;
  }

  if (httpError.statusCode >= 500)
    logger.error({ req, err }, 'Server error occurred');

  res.status(httpError.statusCode);
  res.send({
    statusCode: httpError.statusCode,
    error: httpError.statusText,
    // Only send message for statusCode 4xx
    ...(httpError.statusCode >= 400 &&
    httpError.statusCode < 500 &&
    httpError.message
      ? { message: httpError.message }
      : {}),
  });
};

export default errorHandler;
