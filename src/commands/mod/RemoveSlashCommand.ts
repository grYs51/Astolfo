import { Message, Routes } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import { rest } from '../../utils/functions/rest';

export default class RemoveSlashCommand extends BaseCommand {
  constructor() {
    super('removeslash', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return message.react('⛔');
    }

    return rest
      .delete(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          '1145313388923211886',
        ),
      )
      .then(() => {
        client.logger.info('Slash commands removed');
        return message.react('✅');
      })
      .catch((error) => {
        client.logger.error('Failed to remove slash commands');
        client.logger.error(error);
        return message.react('⛔');
      });
  }
}
