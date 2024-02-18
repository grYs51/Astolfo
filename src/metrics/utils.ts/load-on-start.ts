import { promises as fs } from 'fs';
import * as prometheus from 'prom-client';
import logger from '../../utils/logger';
import parsePrometheusTextFormat from 'parse-prometheus-text-format';

async function readMetricsFile(filePath: string): Promise<string> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Error reading metrics file:', error);
    return '';
  }
}

function initializePrometheusMetrics(metrics: any[]): void {
  console.log(metrics);
  
  metrics.forEach(({ name, labels, values, type }) => {
    
    if(type === 'counter') {
      const counter = new prometheus.Counter({
        name,
        help: name,
        labelNames: Object.keys(labels),
      });
      values.forEach((value, index) => {
        counter.inc(labels, value);
      });
    }
  });
}

async function initPrometheusData(filePath: string) {
  const metricsData = await readMetricsFile(filePath);
  if (!metricsData) {
    logger.error('No metrics data found');
    return;
  }
  const parsedMetrics = parsePrometheusTextFormat(metricsData);
  initializePrometheusMetrics(parsedMetrics);
}

export { initPrometheusData };