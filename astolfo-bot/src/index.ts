require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { Collection, IntentsBitField } from 'discord.js';
import { DiscordInteractions } from 'slash-commands';
import createApp from './api';
import logger from './api/utils/logger';
import { createClient, getDb } from './db';
import { GuildConfiguration } from './db/models';

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

const interaction = new DiscordInteractions({
  applicationId: process.env.APPLICATION_ID!,
  authToken: process.env.BOT_TOKEN!,
  publicKey: process.env.PUBLIC_KEY!,
});

async function main() {
  // create a new express app instance
  
  
  await createClient()
  .then(async (connection) => {
    logger.info('Connected to database');
    
    // register all commands
    const configRepo = connection.getRepository(GuildConfiguration);
    const guildConfigs = await configRepo.find();
    const configs = new Collection<string, GuildConfiguration>();
    guildConfigs.forEach((config) => configs.set(config.guildId, config));
    
    client.configs = configs;
    client.dataSource = getDb();
    
    await registerCommands(client, '../commands');
    await registerEvents(client, '../events');
    await registerSlash(client, '../slashs');
    
    client.slashs.forEach((slash) => {
      slash.createInteraction(client, interaction);
    });
    
    await client.login(process.env.BOT_TOKEN);
  })
  .catch((error) => {
    logger.error('Failed to connect to pg');
    logger.error(error);
    process.exit(1);
  });
  
    const app = createApp();
    app.listen(process.env.PORT || 3000, () => {
      logger.info(`Server started on port ${process.env.PORT || 3000}`);
    });
  }
  
  main().catch((error) => {
    logger.error('Failed to start bot', error);
    process.exit(1);
});