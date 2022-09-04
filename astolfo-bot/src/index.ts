require('dotenv').config();
import 'reflect-metadata';
import {
  registerCommands,
  registerEvents,
  registerSlash,
} from './utils/registry';
import DiscordClient from './client/client';
import { Collection, IntentsBitField } from 'discord.js';
import { DataSource } from 'typeorm';
import { GuildConfiguration } from './typeOrm/entities/GuildConfiguration';
import { io } from 'socket.io-client';
import { entities } from './typeOrm/entities';
import { DiscordInteractions } from 'slash-commands';
import discordModals from 'discord-modals';
import * as DisTube from 'distube';
const client = new DiscordClient({
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

discordModals(client);

const socket = io('http://localhost:3001');

const distube = new DisTube.default(client);
client.distube = distube;

socket.on('guildConfigUpdate', (config: GuildConfiguration) => {
  client.configs.set(config.guildId, config);
});

const AppdataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: entities,
  synchronize: true,
});

AppdataSource.initialize()
  .then(async (dataSource) => {
    const configRepo = dataSource.getRepository(GuildConfiguration);
    const guildConfigs = await configRepo.find();
    const configs = new Collection<string, GuildConfiguration>();
    guildConfigs.forEach((config) => configs.set(config.guildId, config));

    client.configs = configs;

    await registerCommands(client, '../commands');
    await registerEvents(client, '../events');
    await registerSlash(client, '../slashs');

    client.slashs.forEach((slash) => {
      slash.createInteraction(client, interaction);
    });

    await client.login(process.env.BOT_TOKEN);
  })
  .catch((err) => {
    console.log(err);
  });

export default AppdataSource;
