import { Router } from 'express';
import { getMetrics } from './handlers/get-metrics';
import { getUsers } from './handlers/get-users';

export default (router: Router) => {
  router.route('/metrics').get(getMetrics);
  router.route('/users').get(getUsers);
};
