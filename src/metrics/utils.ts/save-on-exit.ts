import { register } from 'prom-client';
import { promises as fsPromises } from 'fs';
import logger from '../../utils/logger';

async function saveToFile(metrics: string) {
  try {
    logger.info('Saving metrics to file');
    await fsPromises.writeFile('metrics.txt', metrics);
  } catch (err) {
    logger.error('Error saving metrics to file', err);
  }
}
// Define shutdown function
async function shutdown() {
  const metrics = await register.metrics();
  await saveToFile(metrics);
  process.exit(0);
}

// Attach shutdown function to process exit events
process.on('exit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
