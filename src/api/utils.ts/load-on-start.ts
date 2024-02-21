import logger from '../../utils/logger';
import { getDb } from '../../db';
import { commandsCountSet, eventsCountSet, slashsCountSet } from './counter';
interface Metrics {
  name: string;
  labels: { [key: string]: string };
  values: { [key: string]: string };
  type: string;
}

async function readMetricsFromDb() {
  const prisma = getDb();
  return prisma.metrics.findUnique({ where: { id: 1 } });
}

function parsePrometheusTextFormat(metricsData: any) {
  const metrics: string = metricsData.jsonb;
  const parsed = metrics
    .split('\n')
    .filter((line: string) => !line.startsWith('#'))
    .filter((line: string) => line !== '')
    .filter((line: string) => line.startsWith('discord_'));
  const parsedMetrics = parsed.map((line: string) => {
    const startOfLabels = line.indexOf('{');
    const endOfLabels = line.indexOf('}');
    const name = line.substring(0, startOfLabels);
    const labels = line.substring(startOfLabels + 1, endOfLabels);
    const value = line.substring(endOfLabels + 2);
    const parsedLabels = labels
      .split(',')
      .map((label) => label.split('='))
      .reduce((acc, [key, value]) => {
        acc[key] = value.replace(/"/g, '');
        return acc;
      }, {});
    return {
      name,
      labels: parsedLabels,
      values: { value },
      type: 'counter',
    };
  });
  return parsedMetrics;
}

function initializePrometheusMetrics(metrics: Metrics[]): void {
  logger.info('Initializing Prometheus metrics');
  metrics.forEach(({ name, labels, values, type }) => {
    if (type === 'counter') {
      switch (name) {
        case 'discord_bot_commands_total':
          commandsCountSet(labels.commandName, parseInt(values.value));
          break;
        case 'discord_bot_events_total':
          eventsCountSet(labels.eventName, parseInt(values.value));
          break;
        case 'discord_bot_slash_total':
          slashsCountSet(labels.slashName, parseInt(values.value));
          break;
        default:
          logger.error(`Unknown metric name ${name}`);
      }
    }
  });
}

async function initPrometheusData(filePath: string) {
  const metricsData = await readMetricsFromDb();
  if (!metricsData) {
    logger.error('No metrics data found');
    return;
  }
  const parsedMetrics = parsePrometheusTextFormat(metricsData);
  initializePrometheusMetrics(parsedMetrics);
}

export { initPrometheusData };
