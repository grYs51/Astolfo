import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import { client } from './client/instance';
import type { Server } from 'http';
import { assertUtcTimeZone, createPrismaClient, getDb } from './db';
import { Logger } from './utils/logger';
import { validateEnv } from './utils/validate-env';
import { setConfigs } from './utils/functions/set-config';
import server from './api';
import { initPrometheusData } from './api/utils/load-on-start';
import { setupShutdownHandler } from './utils/handlers/shutdown-handler';
import { saveGamesToDb } from './utils/handlers/games-handler';
import { startMetricsScheduler } from './utils/schedulers/metrics.scheduler';
import { closeDanglingVoiceSessions } from './utils/handlers/vc';
import { closeDanglingStatuses } from './utils/handlers/presence/status-save';
import { isMockDiscord } from './dev/mock-discord';
import { startupStats } from './utils/startup-stats';
import { loadRules } from './xp/rules';
import { startDigestScheduler } from './utils/schedulers/digest.scheduler';


process.on('uncaughtException', (err) => {
  Logger.error('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled rejection', reason as Error);
});

let httpServer: Server | undefined;

// Close voice sessions and statuses a previous crash left open. Must run
// before the metrics scheduler starts: the cutoff is the last metrics snapshot
// of the previous run, and the first tick would overwrite it with "now"
// (recording the whole downtime as voice time). Also runs before the API serves those rows live.
const recoverDanglingVoiceSessions = async () => {
  // Mock mode has no gateway, so every open row is "dangling" — keep the
  // seeded in-voice sessions open instead
  if (isMockDiscord()) return;
  const recovered = await closeDanglingVoiceSessions();
  startupStats.danglingVoiceSessions = recovered;
  if (recovered > 0) {
    Logger.info(`Closed ${recovered} dangling voice sessions from a previous run`);
  }
  const statuses = await closeDanglingStatuses();
  startupStats.danglingStatuses = statuses;
  if (statuses > 0) {
    Logger.info(`Closed ${statuses} dangling statuses from a previous run`);
  }
};

const main = () =>
  Promise.resolve()
    .then(() => validateEnv())
    .then(() => createPrismaClient())
    .then((db) => assertUtcTimeZone(db))
    .then(() => setConfigs())
    .then(() => loadRules(getDb()))
    .then(() => recoverDanglingVoiceSessions())
    .then(() => saveGamesToDb())
    .then(() => registerCommands())
    .then(() => registerEvents())
    .then(() => registerSlash())
    .then(() => initPrometheusData())
    .then(() => {
      httpServer = server();
    })
    .then(() => startMetricsScheduler())
    .then(() => {
      if (isMockDiscord()) {
        Logger.warn(
          'MOCK_DISCORD=true: not connecting to Discord. The API serves fixture servers/channels/members and /api/auth/login signs in as the mock user. Seed data with `yarn nx run bot:seed`.'
        );
        // No ready event without Discord: start it here for the XP sweep (no digest can post without a gateway)
        startDigestScheduler(client);
        return;
      }
      return client.login(process.env.DISCORD_BOT_TOKEN);
    })
    .then(() => setupShutdownHandler(() => httpServer))
    .catch((error) => {
      Logger.error('Failed to start bot');
      Logger.error(error);
      process.exit(1);
    });

void main(); // main() catches and exits on its own
