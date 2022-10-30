import { json, Router } from 'express';
import errorHandler from '../middleware/error-handler';
import logging from '../middleware/logging';
import datasource from '../middleware/datasource-db';
import requestId from '../middleware/request-id';
import validate from '../middleware/validate';
import discordClient from '../middleware/discord-client';
import { NotFound } from '../utils/http-error';
import registerGuildStatsRoutes from './guildstats';

const apiRouter = Router();

// Register all middleware
apiRouter.use(json());
apiRouter.use(requestId);
apiRouter.use(logging);
apiRouter.use(validate);
apiRouter.use(datasource);
apiRouter.use(discordClient);

// Register all plugins (aka routes)
registerGuildStatsRoutes(apiRouter);

// Catch all
apiRouter.all('*', (_req, _res, next) => {
  next(new NotFound());
});

// Register the error handler as last
apiRouter.use(errorHandler);

export default apiRouter;
