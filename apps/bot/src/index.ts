import {
  registerCommands,
  registerEvents,
  registerInteractions,
  registerSlash,
} from './utils/registry';
import { client } from './client/instance';
import type { Server } from 'http';
import { createPrismaClient } from './db';
import { Logger } from './utils/logger';
import { validateEnv } from './utils/validate-env';
import { setConfigs } from './utils/functions/set-config';
import server from './api';
import { initPrometheusData } from './api/utils.ts/load-on-start';
import { setupShutdownHandler } from './utils/handlers/shutdown-handler';
import { saveGamesToDb } from './utils/handlers/games-handler';
import { startMetricsScheduler } from './utils/schedulers/metrics.scheduler';
import { closeDanglingVoiceSessions } from './utils/handlers/vc';


process.on('uncaughtException', (err) => {
  Logger.error('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled rejection', reason as Error);
});

let httpServer: Server | undefined;

// Close sessions a previous crash left open. Must run before the metrics
// scheduler starts: the cutoff is the last metrics snapshot of the previous
// run, and the first tick would overwrite it with "now" (recording the whole
// downtime as voice time). Also runs before the API serves those rows live.
const recoverDanglingVoiceSessions = async () => {
  const recovered = await closeDanglingVoiceSessions();
  if (recovered > 0) {
    Logger.info(`Closed ${recovered} dangling voice sessions from a previous run`);
  }
};

const main = () =>
  Promise.resolve()
    .then(() => validateEnv())
    .then(() => createPrismaClient())
    .then(() => setConfigs())
    .then(() => recoverDanglingVoiceSessions())
    .then(() => saveGamesToDb())
    .then(() => registerCommands())
    .then(() => registerEvents())
    .then(() => registerSlash())
    .then(() => registerInteractions())
    .then(() => initPrometheusData())
    .then(() => {
      httpServer = server();
    })
    .then(() => startMetricsScheduler())
    .then(() => client.login(process.env.DISCORD_BOT_TOKEN))
    .then(() => setupShutdownHandler(() => httpServer))
    .catch((error) => {
      Logger.error('Failed to start bot');
      Logger.error(error);
      process.exit(1);
    });

main();
