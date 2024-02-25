// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-error
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';

export default class WarnEvent extends BaseEvent {
  constructor() {
    super(Events.Warn);
  }

  async event(client: DiscordClient, error: Error) {
    client.logger.child({ event: 'warn' }).error(error);
  }
}
