require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { Collection, IntentsBitField } from 'discord.js';
import { createClient, getDb } from './db';
import { GuildConfiguration } from './db/models';
import { DiscordInteractions } from "slash-commands";
import logger from './utils/logger';

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

// export const interaction = new DiscordInteractions({
//   applicationId: process.env.DISCORD_CLIENT_ID!,
//   authToken: process.env.DISCORD_BOT_TOKEN!,
//   publicKey: process.env.DISCORD_PUBLIC_KEY!,
// });

async function main() {
  // create a new express app instance
  client.logger = logger;

  // interaction.getApplicationCommands().then((commands) => {
  //   commands.forEach((command) => {
  //     client.interactions.set(command.id, command);
  //   });
  // });

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
        logger.info(slash)
        logger.info(`Registering slash`);
        // slash.createInteraction(client, interaction);
      });

      await client.login(process.env.DISCORD_BOT_TOKEN);
    })
    .catch((error) => {
      logger.error('Failed to connect to pg');
      logger.error(error);
      process.exit(1);
    });
}

main().catch((error) => {
  logger.error('Failed to start bot', error);
  process.exit(1);
});
