import { Router } from 'express';
import registerMetrics from './metrics';
import registerUtils from './utils';
import { storeMetrics } from '../utils.ts/middleware/save-metrics';

const apiRouter = Router();

apiRouter.use(storeMetrics);

registerMetrics(apiRouter);
registerUtils(apiRouter);

export default apiRouter;
