import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Events } from 'discord.js';
import { setStatusCache } from '../../utils/functions/set-status';
import { setVc } from '../../utils/functions/set-vc';
import { checkForNewGuilds } from '../../utils/functions/set-config';
import { closeDanglingVoiceSessions } from '../../utils/handlers/vc';
import { Logger } from '../../utils/logger';

export default class ReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ClientReady);
  }
  async event(client: DiscordClient) {
    Logger.info(client.user?.tag + ' is ready!');

    // Close sessions a previous crash left open BEFORE re-opening rows for
    // everyone currently in voice
    const recovered = await closeDanglingVoiceSessions();
    if (recovered > 0) {
      Logger.info(`Closed ${recovered} dangling voice sessions from a previous run`);
    }

    await setStatusCache();
    await setVc();
    await checkForNewGuilds();
  }
}
