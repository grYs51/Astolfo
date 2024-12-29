// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { Logger } from '../../utils/logger';

export default class ErrorEvent extends BaseEvent {
  constructor() {
    super(Events.Error);
  }

  async event(client: DiscordClient, error: Error) {
    Logger.error('Error:', error);
  }
}
