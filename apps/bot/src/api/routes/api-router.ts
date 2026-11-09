import { json, Router } from 'express';
import registerMetrics from './metrics';
import registerUtils from './utils';
import registerDiscord from './discord';
import registerFeatures from './features';
import registerAdmin from './admin';
import db from '../utils/middleware/db';

const apiRouter = Router();

apiRouter.use(json());
apiRouter.use(db);

registerDiscord(apiRouter);
registerMetrics(apiRouter);
registerUtils(apiRouter);

registerFeatures(apiRouter);
registerAdmin(apiRouter);

export default apiRouter;
