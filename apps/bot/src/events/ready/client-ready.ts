import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { setStatusCache } from '../../utils/functions/set-status';
import { setVc } from '../../utils/functions/set-vc';
import { checkForNewGuilds } from '../../utils/functions/set-config';
import { Logger } from '../../utils/logger';
import { startDigestScheduler } from '../../utils/schedulers/digest.scheduler';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async event(client: DiscordClient) {
    Logger.info(client.user?.tag + ' is ready!');

    // Dangling sessions from a previous crash were already closed in main(),
    // before login, so re-opening rows for everyone in voice is safe here
    await setStatusCache();
    await setVc();
    await checkForNewGuilds();
    startDigestScheduler(client);
  }
}
