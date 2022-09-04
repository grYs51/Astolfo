import { Router } from 'express';
import { getList } from './handlers/get.list';

export default (router: Router) => {
  router //
    .route('/v1/guilds')
    .get(getList);
};
