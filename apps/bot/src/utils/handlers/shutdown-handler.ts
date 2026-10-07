import type { Server } from 'http';
import schedule from 'node-schedule';
import { Logger } from '../logger';
import { saveVc } from '../functions/set-vc';
import { saveAllStatuses } from './presence/status-save';
import { SaveMetrics } from '../../api/utils.ts/save-on-exit';
import { client } from '../../client/instance';
import { disconnect } from '../../db';

let isShuttingDown = false;

/**
 * Hard cap on the whole sequence. Postgres is usually stopped in the same
 * instant we are (dockerd/compose SIGTERMs every container at once), so the
 * flushes below can fail *or hang* — neither may keep the process alive.
 */
const SHUTDOWN_TIMEOUT_MS = 20_000;

/**
 * Runs one shutdown step in isolation. A failing flush costs us that step's
 * data, never the rest of the sequence: before this, the first rejection
 * escaped `shutdown()` as an unhandled rejection and everything after it
 * (status flush, client destroy, `process.exit`) simply never ran, leaving the
 * bot alive on a dead DB until the supervisor SIGKILLed it.
 */
async function step(name: string, fn: () => Promise<unknown>): Promise<void> {
  Logger.info(`${name}...`);
  try {
    await fn();
    Logger.info(`${name}...done`);
  } catch (error) {
    Logger.error(`${name}...failed`, error);
  }
}

async function shutdown(getHttpServer?: () => Server | undefined) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  Logger.info('I got a shutdown signal!');

  const watchdog = setTimeout(() => {
    Logger.error(
      `Shutdown still running after ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  watchdog.unref();

  client.user?.setStatus('invisible');

  // Stop producing work before flushing it. While the gateway and the metrics
  // job are still live, presence/voice handlers keep writing rows behind our
  // back — and once the DB is gone, each one is another unhandled rejection.
  const httpServer = getHttpServer?.();
  if (httpServer) {
    await step(
      'Closing HTTP server',
      () => new Promise<void>((resolve) => httpServer.close(() => resolve()))
    );
  }
  await step('Cancelling scheduled jobs', () => schedule.gracefulShutdown());
  await step('Destroying Discord client', () => client.destroy());

  const date = new Date();
  await step('Saving metrics', () => SaveMetrics());
  await step('Saving voice stats', () => saveVc());
  await step('Saving statuses', () => saveAllStatuses(date));

  await step('Disconnecting database', () => disconnect());

  clearTimeout(watchdog);
  Logger.info('Change Da World... My Final Message!');
  process.exit(0);
}

export function setupShutdownHandler(getHttpServer?: () => Server | undefined) {
  const handler = () => {
    shutdown(getHttpServer).catch((error) => {
      Logger.error('Shutdown sequence crashed — exiting anyway', error);
      process.exit(1);
    });
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}
