import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';

export default class TestCommand extends BaseCommand {
  constructor() {
    super('test', 'testing', []);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    return message.reply({
      content: 'Test command works!',
      allowedMentions: {
        repliedUser: false,
      },
    });
  }
}
