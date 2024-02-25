import BaseEvent from '../../utils/structures/base-event';
import { Events, Message } from 'discord.js';
import DiscordClient from '../../client/client';
import { saveMessage } from '../../utils/handlers/message/save-message';
import { runCommand } from '../../utils/handlers/message/run-command';

export default class MessageEvent extends BaseEvent {
  constructor() {
    super(Events.MessageCreate);
  }

  async event(client: DiscordClient, message: Message) {
    if (!message || message.author.bot) return;

    saveMessage(message);

    runCommand(client, message);
  }
}
