import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async run(client: DiscordClient) {
    client.logger.info('Astolfo is ready!!');
  }
}
