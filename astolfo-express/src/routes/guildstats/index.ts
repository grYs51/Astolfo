import { Router } from 'express';
import { getAll } from './handlers/getAll';


export default (router: Router) => {
  router
    .route('/v1/guild-stats')
    .get( getAll);
};
