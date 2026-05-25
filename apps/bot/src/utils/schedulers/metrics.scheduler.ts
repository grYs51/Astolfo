import schedule from 'node-schedule';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';
import { Logger } from '../logger';

/**
 * Saves Prometheus metrics to the database every 30 seconds.
 * This replaces the previous per-request middleware approach.
 */
export function startMetricsScheduler() {
  schedule.scheduleJob('*/30 * * * * *', async () => {
    try {
      await SaveMetrics();
    } catch (err) {
      Logger.error('Metrics scheduler: failed to save metrics', err);
    }
  });

  Logger.info('Metrics scheduler started (every 30s)');
}
