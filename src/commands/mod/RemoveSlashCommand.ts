import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import DiscordInteractions from 'slash-commands';
import { interaction } from '../..';

export default class RemoveSlashCommand extends BaseCommand {
  constructor() {
    super('removeSlash', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      message.react('⛔');
      return;
    }

    client.logger.info('Removing slash commands');
    interaction
      .getApplicationCommands()
      .then((commands) => {
        commands.forEach((command) => {
          interaction
            .deleteApplicationCommand(command.id)
            .catch(client.logger.error);
        });
      })
      .catch(client.logger.error);

    client.logger.info('Slash commands removed');

    message.react('✅');
  }
}
