import { Message, REST, Routes } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import logger from '../../utils/logger';
import { rest } from '../../utils/functions/rest';

export default class UpdateSlashCommands extends BaseCommand {
  constructor() {
    super('updateslashcommands', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id !== client.ownerId) {
      return message.react('⛔');
    }

    return rest
      .put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          '1145313388923211886',
        ),
        {
          body: client.slashs.map((slash) =>
            slash.createInteraction(client).toJSON(),
          ),
        },
      )
      .then(() => {
        logger.info('Successfully registered application commands.');
        return message.react('✅');
      })
      .catch((error) => {
        logger.error('Failed to register application commands');
        logger.error(error);
        return message.react('⛔');
      });
  }
}
