import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import { MessageUtils } from '../../utils/message-utils';

export default class TestCommand extends BaseCommand {
  constructor() {
    super('test', 'testing', []);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    MessageUtils.reply(message, 'Test command works!');
  }
}
