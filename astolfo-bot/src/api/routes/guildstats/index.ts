import { Router } from 'express';
import { isAuthenticated } from '../../middleware/isAuthenticated';
import { getAll, getAllByGuildId } from './handlers';

export default (router: Router) => {
  router.route('/v1/guild-stats').get(isAuthenticated, getAll);

  router.route('/v1/guild-stats/:id').get(isAuthenticated, getAllByGuildId);
};
