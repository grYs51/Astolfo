import logger from '../logger';
import { saveVc } from '../functions/set-vc';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn('Shutting down... Saving what we can!', 'Cya later!');

  await SaveMetrics();
  await saveVc();

  process.exit(0);
}

export function setupShutdownHandler() {
  process.on('exit', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
