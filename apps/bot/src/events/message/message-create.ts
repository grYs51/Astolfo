import BaseEvent from '../../utils/structures/base-event';
import { Events, Message } from 'discord.js';
import DiscordClient from '../../client/client';
import { saveMessage } from '../../utils/handlers/message/save-message';
import { runCommand } from '../../utils/handlers/message/run-command';
import { awardAndAnnounce } from '../../xp/level-up';

export default class MessageEvent extends BaseEvent {
  constructor() {
    super(Events.MessageCreate);
  }

  async event(client: DiscordClient, message: Message) {
    if (!message || message.author.bot) return;

    // Awaited so failures reach BaseEvent's handler (with the event name)
    // instead of becoming context-free unhandled rejections
    await Promise.all([
      saveMessage(message).then(
        (saved) => saved && awardAndAnnounce(client, saved.guild_id, saved.user_id, ['MESSAGE'])
      ),
      runCommand(client, message),
    ]);
  }
}
