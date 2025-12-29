import { Router } from 'express';
import { getActiveServers } from './active-servers';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';

export default (router: Router) => {
  router.get('/features/active-servers',isAuthenticated,  getActiveServers);
};
