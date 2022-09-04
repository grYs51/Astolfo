import { json, Router } from 'express';
import dc from '../middleware/client';
import errorHandler from '../middleware/error-handler';
import logging from '../middleware/logging';
import { NotFound } from '../utils/http-errors';
import registerDiscordBotRoutes from './v1/bot';

const apiRouter = Router();

// Register all middleware
apiRouter.use(json());
// apiRouter.use(requestId);
apiRouter.use(logging);
apiRouter.use(dc);
// apiRouter.use(validate);
// apiRouter.use(mongoDb);

// Register all plugins (aka routes)
registerDiscordBotRoutes(apiRouter);
// registerGenreRoutes(apiRouter);
// registerTProfileRoutes(apiRouter);

// Catch all
apiRouter.all('*', (_req, _res, next) => {
  next(new NotFound());
});

// Register the error handler as last
apiRouter.use(errorHandler);

export default apiRouter;
