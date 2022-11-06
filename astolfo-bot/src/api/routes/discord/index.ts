import { Router } from 'express';
import { isAuthenticated } from '../../middleware/isAuthenticated';
import { guilds, status } from './handlers';

export default (router: Router) => {
  router.route('/discord/@me').get(isAuthenticated, status);
  router.route('/discord/@me/guilds').get(isAuthenticated, guilds);
};
