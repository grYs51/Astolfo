import { json, Router } from 'express';

import errorHandler from '../middleware/error-handler';
import logging from '../middleware/logging';
import mongoDb from '../middleware/mongo-db';
import requestId from '../middleware/request-id';
import validate from '../middleware/validate';
import { NotFound } from '../utils/http-error';
import registerGuildStatsRoutes from './guildstats';

const apiRouter = Router();

// Register all middleware
apiRouter.use(json());
apiRouter.use(requestId);
apiRouter.use(logging);
apiRouter.use(validate);
apiRouter.use(mongoDb);

// Register all plugins (aka routes)
registerGuildStatsRoutes(apiRouter);

// Catch all
apiRouter.all('*', (_req, _res, next) => {
  next(new NotFound());
});

// Register the error handler as last
apiRouter.use(errorHandler);

export default apiRouter;
