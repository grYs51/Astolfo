// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildDelete
import { Events, Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { closeGuildVoiceSessions } from '../../utils/handlers/vc';

/**
 * The bot was removed from a guild (an outage emits GuildUnavailable
 * instead). No more voice events arrive for it, so close its open sessions —
 * otherwise they'd count live time until the next restart.
 */
export default class GuildDeleteEvent extends BaseEvent {
  constructor() {
    super(Events.GuildDelete);
  }

  async event(client: DiscordClient, guild: Guild) {
    const closed = await closeGuildVoiceSessions(guild.id, new Date());
    if (closed > 0) {
      Logger.info(`Left guild ${guild.id}: closed ${closed} open voice sessions`);
    }
  }
}
