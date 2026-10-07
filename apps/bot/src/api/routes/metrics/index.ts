import { Router } from 'express';
import { getMetrics } from './handlers/get-metrics';
import { requireMetricsToken } from '../../utils/middleware/requireMetricsToken';

export default (router: Router) => {
  router.route('/metrics').get(requireMetricsToken, getMetrics);
};
