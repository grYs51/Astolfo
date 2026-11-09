import { Logger } from '../../utils/logger';
import { getDb } from '../../db';
import { Counter, register } from 'prom-client';
// Registers the counters before they're looked up by name
import './counter';

// Shape produced by prom-client's register.getMetricsAsJSON()
interface StoredMetric {
  name: string;
  type: string;
  values: { value: number; labels: Record<string, string> }[];
}

async function readMetricsFromDb() {
  const prisma = getDb();
  return prisma.metrics.findUnique({ where: { id: 1 } });
}

function restoreCounters(metrics: StoredMetric[]): void {
  Logger.info('Initializing Prometheus metrics');
  for (const metric of metrics) {
    const counter = register.getSingleMetric(metric.name);
    if (metric.type !== 'counter' || !(counter instanceof Counter)) continue;
    try {
      for (const { value, labels } of metric.values) {
        counter.inc(labels, value);
      }
    } catch (error) {
      // A renamed label would throw here; losing one counter beats a boot loop
      Logger.warn(`Skipping stored metric ${metric.name}`, error);
    }
  }
}

async function initPrometheusData() {
  const metricsData = await readMetricsFromDb();
  if (!metricsData) {
    Logger.warn('No metrics data found');
    return;
  }

  const stored = metricsData.jsonb;
  if (!Array.isArray(stored)) {
    // Pre-JSON rows stored the raw Prometheus text blob as a string; it will
    // be overwritten in the new format on the next scheduled save.
    Logger.warn('Stored metrics are in the legacy text format — skipping restore');
    return;
  }

  restoreCounters(stored as unknown as StoredMetric[]);
}

export { initPrometheusData };
