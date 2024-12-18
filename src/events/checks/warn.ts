// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { Logger } from '../../utils/logger';

export default class WarnEvent extends BaseEvent {
  constructor() {
    super(Events.Warn);
  }

  async event(client: DiscordClient, error: Error) {
    Logger.warn('Warning:', error);
  }
}
