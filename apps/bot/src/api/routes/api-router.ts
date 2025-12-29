import { json, Router } from 'express';
import registerMetrics from './metrics';
import registerUtils from './utils';
import registerDiscord from './discord';
import registerFeatures from './features';

import { storeMetrics } from '../utils.ts/middleware/save-metrics';
import db from '../utils.ts/middleware/db';

const apiRouter = Router();

apiRouter.use(json());
apiRouter.use(db);
apiRouter.use(storeMetrics);

registerDiscord(apiRouter);
registerMetrics(apiRouter);
registerUtils(apiRouter);

registerFeatures(apiRouter);

export default apiRouter;
