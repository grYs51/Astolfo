import logger from '../logger';
import { saveVc } from '../functions/set-vc';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';
import { client } from '../..';
import { disconnect } from '../../db';

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('I got a shutdown signal!');
  client.user?.setStatus('invisible');

  logger.info('Saving metrics and voice stats');
  await SaveMetrics();
  await saveVc();

  await disconnect();
  logger.info('Database client disconnected');

  logger.info('Change Da World... My Final Message!');
  process.exit(0);
}

export function setupShutdownHandler() {
  process.on('exit', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
