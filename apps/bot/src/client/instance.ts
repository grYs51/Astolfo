import { IntentsBitField } from 'discord.js';
import DiscordClient from './client';

/**
 * The bot's single Discord client. Kept out of index.ts so modules (and
 * tests) can import it without running the startup sequence in main().
 */
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
