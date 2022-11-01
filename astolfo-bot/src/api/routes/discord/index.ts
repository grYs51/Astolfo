import { Router } from "express";
import { guilds, status } from './handlers';

export default (router: Router) => {
  router.route('/discord/@me').get(status);
  router.route('/discord/@me/guilds').get(guilds);
}