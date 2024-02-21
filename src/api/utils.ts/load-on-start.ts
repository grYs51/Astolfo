import logger from '../../utils/logger';
import { getDb } from '../../db';
import { commandsCountSet, eventsCountSet, slashsCountSet } from './counter';
import { metrics } from '@prisma/client';

interface ParsedMetric {
  key: string;
  attributes: { [key: string]: string };
  value: number;
}


async function readMetricsFromDb() {
  const prisma = getDb();
  return prisma.metrics.findUnique({ where: { id: 1 } });
}

function parsePrometheusTextFormat(metricsData: metrics): { [key: string]: ParsedMetric[] } {
  const metrics = metricsData.jsonb as string;
  const parsedData: { [key: string]: ParsedMetric[] } = {};

  metrics
    .split('\n')
    .filter(line => line.startsWith("discord_"))
    .forEach(line => {
      if (line.startsWith("# TYPE")) {
        const metricType = line.split(" ")[3];
        parsedData[metricType] = [];
      } else {
        const [keyValue, value] = line.split(" ");
        const [key, attributes] = keyValue.split("{");
        const parsedAttributes = attributes
          ? attributes.slice(0, -1).split(", ").reduce((acc, attribute) => {
              const [attrKey, attrValue] = attribute.split("=");
              acc[attrKey] = attrValue.slice(1, -1);
              return acc;
            }, {} as { [key: string]: string })
          : {};
        const metricType = Object.keys(parsedData)[Object.keys(parsedData).length - 1];
        parsedData[metricType].push({ key, attributes: parsedAttributes, value: parseInt(value) });
      }
    });

  return parsedData;
}

function initializePrometheusMetrics(metrics: { [metricType: string]: ParsedMetric[] }): void {
  logger.info('Initializing Prometheus metrics');
  Object.entries(metrics).forEach(([metricType, metricList]) => {
    if (metricType === 'counter') {
      metricList.forEach(({ key, attributes, value }) => {
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
            logger.error(`Unknown metric name ${key}`);
        }
      });
    }
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
