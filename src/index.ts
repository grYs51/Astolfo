require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { IntentsBitField } from 'discord.js';
import { createPrismaClient } from './db';
import logger from './utils/logger';
import { setConfigs } from './utils/functions/set-config';
import server from './api';
import { initPrometheusData } from './api/utils.ts/load-on-start';
import { setupShutdownHandler } from './utils/handlers/shutdown-handler'; // Import the new shutdown handler

export const client = new DiscordClient({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
  ],
});

const main = () =>
  createPrismaClient()
    .then(() => setConfigs())
    .then(() => registerCommands())
    .then(() => registerEvents())
    .then(() => registerSlash())
    .then(() => initPrometheusData())
    .then(() => server())
    .then(() => client.login(process.env.DISCORD_BOT_TOKEN))
    .then(() => setupShutdownHandler())
    .catch((error) => {
      logger.error('Failed to start bot');
      logger.error(error);
      process.exit(1);
    });

main();
