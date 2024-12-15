import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { setStatusCache } from '../../utils/functions/set-status';
import { setVc } from '../../utils/functions/set-vc';
import { checkForNewGuilds } from '../../utils/functions/set-config';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async event(client: DiscordClient) {
    client.logger.info('Astolfo is ready!!');

    await setStatusCache();
    await setVc();
    await checkForNewGuilds();
  }
}
