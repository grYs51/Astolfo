import { Router } from 'express';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import { getActiveServers } from './active-servers';

export default (router: Router) => {
  router.use('/features', router);

  // Features
  router.get('/active-servers', isAuthenticated, getActiveServers);
};
