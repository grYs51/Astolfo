import {
  registerCommands,
  registerEvents,
  registerInteractions,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { IntentsBitField } from 'discord.js';
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

export const client = new DiscordClient({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
  ],
});

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('Unhandled rejection', reason as Error);
});

let httpServer: Server | undefined;

const main = () =>
  Promise.resolve()
    .then(() => validateEnv())
    .then(() => createPrismaClient())
    .then(() => setConfigs())
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
