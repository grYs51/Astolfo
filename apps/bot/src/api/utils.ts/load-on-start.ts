import { Logger } from '../../utils/logger';
import { getDb } from '../../db';
import { commandsCountSet, eventsCountSet, slashsCountSet } from './counter';

interface ParsedMetric {
  key: string;
  attributes: { [key: string]: string };
  value: number;
}

async function readMetricsFromDb() {
  const prisma = getDb();
  return prisma.metrics.findUnique({ where: { id: 1 } });
}

function parsePrometheusTextFormat(metricsData: any) {
  const metrics: string = metricsData.jsonb;
  const parsed = metrics
    .split('\n')
    .filter((line: string) => line !== '')
    .filter((line: string) => !line.startsWith('# HELP'))
    .filter((line: string) => line.includes('discord_'));

  const parsedData: { [key: string]: ParsedMetric[] } = {};

  let metricType: string | null = null;

  for (const line of parsed) {
    if (line.startsWith('# TYPE')) {
      metricType = line.split(' ')[3];
      parsedData[metricType] = parsedData[metricType] || [];
    } else {
      const [keyValue, value] = line.split(' ');
      const [key, attributes] = keyValue.split('{');
      const parsedAttributes = attributes
        ? attributes
            .slice(0, -1)
            .split(', ')
            .reduce(
              (acc: { [key: string]: string }, attribute) => {
                const [attrKey, attrValue] = attribute.split('=');
                acc[attrKey] = attrValue.slice(1, -1);
                return acc;
              },
              {} as { [key: string]: string }
            )
        : {};
      parsedData[metricType!].push({
        key,
        attributes: parsedAttributes,
        value: parseInt(value),
      });
    }
  }
  return parsedData;
}

function initializePrometheusMetrics(metrics: {
  [metricType: string]: ParsedMetric[];
}): void {
  Logger.info('Initializing Prometheus metrics');
  Object.keys(metrics).forEach((metricKey) => {
    metrics[metricKey].forEach(({ key, attributes, value }) => {
      if (metricKey === 'counter') {
        switch (key) {
          case 'discord_bot_commands_total':
            commandsCountSet(attributes.commandName, value);
            break;
          case 'discord_bot_events_total':
            eventsCountSet(attributes.eventName, value);
            break;
          case 'discord_bot_slash_total':
            slashsCountSet(attributes.slashName, value);
            break;
          default:
            Logger.error(`Unknown metric name ${key}`);
        }
      }
    });
  });
}
async function initPrometheusData() {
  const metricsData = await readMetricsFromDb();
  if (!metricsData) {
    Logger.error('No metrics data found');
    return;
  }
  const parsedMetrics = parsePrometheusTextFormat(metricsData);
  initializePrometheusMetrics(parsedMetrics);
}

export { initPrometheusData };
