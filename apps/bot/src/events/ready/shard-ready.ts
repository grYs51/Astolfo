import { Events } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { setVc } from '../../utils/functions/set-vc';
import { closeLeftVoiceSessions } from '../../utils/handlers/vc';

/**
 * Fires on every fresh gateway session: the first login and each re-identify
 * (ClientReady fires only once per process). A re-identify doesn't replay
 * missed voice events, so bring the open sessions in line with who is in
 * voice now. Dangling rows from a crash were already closed in main().
 */
export default class ShardReadyEvent extends BaseEvent {
  constructor() {
    super(Events.ShardReady);
  }

  async event(client: DiscordClient) {
    const closed = await closeLeftVoiceSessions(new Date());
    if (closed > 0) {
      Logger.warn(`Closed ${closed} voice sessions whose leave was missed during a reconnect`);
    }
    await setVc();
  }
}
