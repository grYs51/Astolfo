import { Logger } from '../logger';
import { saveVc } from '../functions/set-vc';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';
import { client } from '../..';
import { disconnect } from '../../db';

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  Logger.info('I got a shutdown signal!');
  client.user?.setStatus('invisible');

  Logger.info('Saving metrics...');
  await SaveMetrics();

  Logger.info('Saving voice stats...');
  await saveVc();

  Logger.info('saving voice stats...done');

  await disconnect();
  Logger.info('Database client disconnected');

  Logger.info('Change Da World... My Final Message!');
  process.exit(0);
}

export function setupShutdownHandler() {
  process.on('exit', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
