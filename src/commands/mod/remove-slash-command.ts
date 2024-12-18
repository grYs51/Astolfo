import { Message, Routes } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import rest from '../../utils/functions/rest';

export default class RemoveSlashCommand extends BaseCommand {
  constructor() {
    super('removeslash', 'mod', ['rs']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return message.react('⛔');
    }

    return Promise.all([
      this.removeSlashCommands(),
      this.removeGuildSlashCommands(args[0]),
    ])
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
