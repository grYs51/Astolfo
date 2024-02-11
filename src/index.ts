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
import logger from './utils/logger';
import { guild_configs } from '@prisma/client';

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

async function main() {
  await createClient()
    .then(async (connection) => {
      logger.info('Connected to database');

      // register all commands
      const configRepo = connection.guild_configs;
      const guildConfigs = await configRepo.findMany();
      const configs = new Collection<string, guild_configs>();
      guildConfigs.forEach((config) => configs.set(config.guild_id, config));

      client.guildConfigs = configs;
      client.dataSource = getDb();

      await registerCommands(client, '../commands');
      await registerEvents(client, '../events');
      await registerSlash(client, '../slashs');
      
      await client.login(process.env.DISCORD_BOT_TOKEN);
    })
    .catch(logger.error);
}

main().catch((error) => {
  logger.error('Failed to start bot', error);
  process.exit(1);
});
