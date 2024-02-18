// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';

export default class ErrorEvent extends BaseEvent {
  constructor() {
    super(Events.Error);
  }

  async event(client: DiscordClient, error: Error) {
    client.logger.error(error);
  }
}
