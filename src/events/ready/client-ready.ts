import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { setStatusCache } from '../../utils/functions/set-status';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async event(client: DiscordClient) {
    client.logger.info('Astolfo is ready!!');

    setStatusCache();
  }
}
