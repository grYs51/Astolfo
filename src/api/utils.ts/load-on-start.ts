import logger from '../../utils/logger';
import { getDb } from '../../db';
import {
  CommandCounterArgs,
  EventCounterArgs,
  SlashCounterArgs,
  commandsCountSet,
  eventsCountSet,
  slashsCountSet,
} from './counter';
const metricKeyRegex = /^(.+){(.+)}$/;
const attributeRegex = /^(.+)="(.+)"$/;

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
      const [, eventKey, attributesString] =
        keyValue.match(metricKeyRegex) || [];

      const attributes =
        attributesString?.split(',').reduce(
          (atts, attStr) => {
            const [, attKey, attValue] = attStr.match(attributeRegex) || [];
            if (!attValue || !attKey) return atts;
            atts[attKey] = attValue;
            return atts;
          },
          {} as Record<string, string>
        ) || {};

      parsedData[metricType!].push({
        key: eventKey,
        attributes,
        value: parseInt(value),
      });
    }
  }
  return parsedData;
}

function initializePrometheusMetrics(metrics: {
  [metricType: string]: ParsedMetric[];
}): void {
  logger.info('Initializing Prometheus metrics');
  Object.keys(metrics).forEach((metricKey) => {
    metrics[metricKey].forEach(({ key, attributes, value }) => {
      if (metricKey === 'counter') {
        switch (key) {
          case 'discord_bot_commands_total':
            commandsCountSet(attributes as CommandCounterArgs, value);
            break;
          case 'discord_bot_events_total':
            eventsCountSet(attributes as EventCounterArgs, value);
            break;
          case 'discord_bot_slash_total':
            slashsCountSet(attributes as SlashCounterArgs, value);
            break;
          default:
            logger.error(`Unknown metric name ${key}`);
        }
      }
    });
  });
}
async function initPrometheusData() {
  const metricsData = await readMetricsFromDb();
  if (!metricsData) {
    logger.error('No metrics data found');
    return;
  }
  const parsedMetrics = parsePrometheusTextFormat(metricsData);
  initializePrometheusMetrics(parsedMetrics);
}

export { initPrometheusData };
