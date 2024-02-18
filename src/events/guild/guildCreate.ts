// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildCreate
import { Events, Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class GuildCreateEvent extends BaseEvent {
  constructor() {
    super(Events.GuildCreate);
  }

  async event(client: DiscordClient, guild: Guild) {
    const config = await client.dataSource.guildConfigurations.upsert({
      where: {
        guild_id: guild.id,
      },
      update: {},
      create: {
        guild_id: guild.id,
        prefix: '!',
      },
    });
  
    client.guildConfigs.set(guild.id, config);
  
    if (config) {
      client.logger.info('A configuration was found or created!');
    } else {
      client.logger.info('A configuration could not be found or created.');
    }
  }
}
