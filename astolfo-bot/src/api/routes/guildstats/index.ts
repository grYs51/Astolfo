import { Router } from 'express';
import { getAll } from './handlers/getAll';
import { getAllByGuildId } from './handlers/getAllByGuildId';

export default (router: Router) => {
  router
    .route('/v1/guild-stats')
    .get(getAll);

  router
    .route('/v1/guild-stats/:id')
    .get(getAllByGuildId);
};
