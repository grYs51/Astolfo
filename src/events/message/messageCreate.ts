import BaseEvent from '../../utils/structures/BaseEvent';
import { Events, Message } from 'discord.js';
import DiscordClient from '../../client/client';

export default class MessageEvent extends BaseEvent {
  constructor() {
    super(Events.MessageCreate);
  }

  async event(client: DiscordClient, message: Message) {
    if (!message || message.author.bot ) return;

    const config = client.guildConfigs.get(message.guildId!);
    if (!config) return;

    if (message.content.startsWith(config.prefix)) {
      const [cmdName, ...cmdArgs] = message.content
        .slice(config.prefix.length)
        .trim()
        .split(/\s+/);
      const command = client.commands.get(cmdName);
      if (command) {
        return command.run(client, message, cmdArgs);
      }
    }
  }
}
