import { Logger } from '../../utils/logger';
import { getDb } from '../../db';
import { commandsCountSet, eventsCountSet, slashsCountSet } from './counter';

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
    if (metric.type !== 'counter') continue;
    for (const { value, labels } of metric.values) {
      switch (metric.name) {
        case 'discord_bot_commands_total':
          commandsCountSet(labels.commandName, value);
          break;
        case 'discord_bot_events_total':
          eventsCountSet(labels.eventName, value);
          break;
        case 'discord_bot_slash_total':
          slashsCountSet(labels.slashName, value);
          break;
        default:
          break;
      }
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
