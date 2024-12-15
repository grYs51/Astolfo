import BaseEvent from '../../utils/structures/base-event';
import { Events, Message } from 'discord.js';
import { saveMessage } from '../../utils/handlers/message/save-message';
import { runCommand } from '../../utils/handlers/message/run-command';

export default class MessageEvent extends BaseEvent {
  constructor() {
    super(Events.MessageCreate);
  }

  async event(client, message: Message) {
    if (!message || message.author.bot) return;

    saveMessage(message);

    runCommand(client, message);
  }
  getGuildId(client, message: Message) {
    return message.guild?.id || 'DM';
  }
  getUserId(client, message: Message) {
    return message.author.id;
  }
}
