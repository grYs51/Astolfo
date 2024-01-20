// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-messageCreate
import { Message } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class AntiMaxbot extends BaseEvent {
  constructor() {
    super('messageCreate');
  }

  async run(client: DiscordClient, message: Message) {
    if (
      message.author.id === '932747197911543858' &&
      message.guildId !== '571011756181291008' &&
      message.channelId == '935284944371073044'
    ) {
      await message.delete();
      return;
    }
  }
}
