import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { setStatusCache } from '../../utils/functions/set-status';
import { checkForNewGuilds } from '../../utils/functions/set-config';
import { Logger } from '../../utils/logger';
import { startDigestScheduler } from '../../utils/schedulers/digest.scheduler';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async event(client: DiscordClient) {
    Logger.info(client.user?.tag + ' is ready!');

    // Voice sessions are opened in shard-ready.ts (also runs on reconnects)
    await setStatusCache();
    await checkForNewGuilds();
    startDigestScheduler(client);
  }
}
