import { Events, Presence } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { handleUserPresenceChange } from '../../utils/handlers/presence';

export default class PresenceUpdateEvent extends BaseEvent {
  constructor() {
    super(Events.PresenceUpdate);
  }

  async event(client: DiscordClient, oldPresence: Presence | null, newPresence: Presence) {
    const date = new Date();

    return handleUserPresenceChange(oldPresence, newPresence, date);
  }
}
