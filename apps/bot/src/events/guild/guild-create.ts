// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildCreate
import { Events, Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { defaultPrefix, recordGuildEvent } from '../../utils/functions/set-config';

export default class GuildCreateEvent extends BaseEvent {
  constructor() {
    super(Events.GuildCreate);
  }

  // Only real joins: discord.js doesn't emit GuildCreate for the servers it loads at startup
  async event(client: DiscordClient, guild: Guild) {
    const [config] = await Promise.all([
      client.dataSource.guildConfigurations.upsert({
        where: {
          guild_id: guild.id,
        },
        update: {},
        create: {
          guild_id: guild.id,
          prefix: defaultPrefix(),
        },
      }),
      recordGuildEvent(client, guild.id, 'join'),
    ]);

    client.guildConfigs.set(guild.id, config);

    if (config) {
      Logger.info('A configuration was found or created!');
    } else {
      Logger.info('A configuration could not be found or created.');
    }
  }
}
