import type { Server } from 'http';
import { Logger } from '../logger';
import { saveVc } from '../functions/set-vc';
import { saveAllStatuses } from './presence/status-save';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';
import { client } from '../..';
import { disconnect } from '../../db';

let isShuttingDown = false;

async function shutdown(getHttpServer?: () => Server | undefined) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  Logger.info('I got a shutdown signal!');
  client.user?.setStatus('invisible');

  // Stop accepting new API requests, let in-flight ones finish
  const httpServer = getHttpServer?.();
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    Logger.info('HTTP server closed');
  }

  Logger.info('Saving metrics...');
  await SaveMetrics();

  Logger.info('Saving voice stats...');
  await saveVc();
  Logger.info('Saving voice stats...done');

  Logger.info('Saving statuses...');
  await saveAllStatuses(new Date()).catch((error) =>
    Logger.error('Failed to flush statuses on shutdown', error)
  );
  Logger.info('Saving statuses...done');

  await client.destroy();
  Logger.info('Discord client destroyed');

  await disconnect();
  Logger.info('Database client disconnected');

  Logger.info('Change Da World... My Final Message!');
  process.exit(0);
}

export function setupShutdownHandler(getHttpServer?: () => Server | undefined) {
  process.on('SIGINT', () => shutdown(getHttpServer));
  process.on('SIGTERM', () => shutdown(getHttpServer));
}
