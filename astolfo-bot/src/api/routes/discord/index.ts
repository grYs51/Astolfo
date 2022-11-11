import { Router } from 'express';
import { isAuthenticated } from '../../middleware/isAuthenticated';
import { guildMember, guilds, me } from './handlers';

export default (router: Router) => {
  router.route('/discord/@me').get(isAuthenticated, me);
  router.route('/discord/@me/guilds').get(isAuthenticated, guilds);
  router.route('/discord/@me/guilds/:id/member').get(isAuthenticated, guildMember);
};
