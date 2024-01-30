require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { Collection, IntentsBitField, REST, Routes } from 'discord.js';
import { createClient, getDb } from './db';
import logger from './utils/logger';
import { guild_configurations } from '@prisma/client';

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
  // client.logger = logger;

  // await interaction.getApplicationCommands().then((commands) => {
  //   if (commands?.length === 0) return
  //   console.log(commands);

  //   commands?.forEach((command) => {
  //     client.interactions.set(command.id, command);
  //   });
  // });

  await createClient()
    .then(async (connection) => {
      logger.info('Connected to database');

      // register all commands
      const configRepo = connection.guild_configurations;
      const guildConfigs = await configRepo.findMany();
      const configs = new Collection<string, guild_configurations>();
      guildConfigs.forEach((config) => configs.set(config.guild_id, config));

      client.guildConfigs = configs;
      client.dataSource = getDb();

      await registerCommands(client, '../commands');
      await registerEvents(client, '../events');
      await registerSlash(client, '../slashs');

      

      await client.login(process.env.DISCORD_BOT_TOKEN);
    })
    .catch((error) => {
      logger.error(error);
    });
}

main().catch((error) => {
  logger.error('Failed to start bot', error);
  process.exit(1);
});
