import { Message, Routes } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import rest from '../../utils/functions/rest';
import { Logger } from '../../utils/logger';
import { MessageUtils } from '../../utils/message-utils';

export default class RemoveSlashCommand extends BaseCommand {
  constructor() {
    super('removeslash', 'mod', ['rs']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return MessageUtils.react(message, '⛔');
    }

    return Promise.all([
      this.removeSlashCommands(),
      this.removeGuildSlashCommands(args[0]),
    ])
      .then(() => {
        Logger.info('Slash commands removed');
        return MessageUtils.react(message, '✅');
      })
      .catch((error) => {
        Logger.error('Failed to remove slash commands');
        Logger.error(error);
        return MessageUtils.react(message, '💥');
      });
  }

  private async removeSlashCommands() {
    return rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: [] }
    );
  }

  private async removeGuildSlashCommands(guildId: string) {
    if (!guildId) return Promise.resolve();

    return rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId),
      { body: [] }
    );
  }
}
