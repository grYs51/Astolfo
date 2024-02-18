require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { IntentsBitField } from 'discord.js';
import { createClient } from './db';
import logger from './utils/logger';
import { setConfigs } from './utils/functions/setConfig';
import app from './metrics';

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

function main() {
  createClient()
    .then(setConfigs)
    .then(() => registerCommands())
    .then(() => registerEvents())
    .then(() => registerSlash())
    .then(() => client.login(process.env.DISCORD_BOT_TOKEN))
    .then(() => app)
    .catch((error) => {
      logger.error('Failed to start bot');
      logger.error(error);
      process.exit(1);
    });
}

main();
