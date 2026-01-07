import { Router } from 'express';
import { isAuthenticated } from '../../utils.ts/middleware/isAuthenticated';
import { getActiveServers } from './active-servers';
import { getVoiceStats } from './voice-stats';

export default (router: Router) => {
  router.use('/features', router);

  // Features
  router.get('/active-servers', isAuthenticated, getActiveServers);

  // Voice Stats from specified server
  router.use('/voice-stats/:serverId', isAuthenticated, getVoiceStats);
};
