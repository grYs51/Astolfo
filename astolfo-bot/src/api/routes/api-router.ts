import { json, Router, urlencoded } from 'express';
import errorHandler from '../middleware/error-handler';
import logging from '../middleware/logging';
import datasource from '../middleware/datasource-db';
import requestId from '../middleware/request-id';
import validate from '../middleware/validate';
import discordClient from '../middleware/discord-client';
import { NotFound } from '../utils/http-error';
import registerGuildStatsRoutes from './guildstats';
import registerAuthRoutes from './auth';
const apiRouter = Router();

// Register all middleware
apiRouter.use(json());
// apiRouter.use(urlencoded());
apiRouter.use(requestId);
apiRouter.use(logging);
apiRouter.use(validate);
apiRouter.use(datasource);
apiRouter.use(discordClient);

// Register all plugins (aka routes)
registerAuthRoutes(apiRouter);
registerGuildStatsRoutes(apiRouter);

// Catch all
apiRouter.all('*', (_req, _res, next) => {
  next(new NotFound());
});

// Register the error handler as last
apiRouter.use(errorHandler);

export default apiRouter;
