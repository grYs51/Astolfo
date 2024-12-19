import { Message, Routes } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import rest from '../../utils/functions/rest';
import { MessageUtils } from '../../utils/message-utils';

export default class UpdateSlashCommands extends BaseCommand {
  constructor() {
    super('updateslash', 'mod', ['us']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id !== client.ownerId) {
      return MessageUtils.react(message, '⛔');
    }

    return rest
      .put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
        body: client.slashs.map((slash) =>
          slash.createInteraction(client).toJSON()
        ),
      })
      .then(() => {
        Logger.info('Successfully registered application commands.');
        return MessageUtils.react(message, '✅');
      })
      .catch((error) => {
        Logger.error('Failed to register application commands.', error);
        return MessageUtils.react(message, '💥');
      });
  }
}
