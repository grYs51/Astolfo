// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildCreate
import { Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class GuildCreateEvent extends BaseEvent {
  constructor() {
    super('guildCreate');
  }

  async run(client: DiscordClient, guild: Guild) {
    const config = await client.dataSource.guildConfigurations.findUnique({
      where: {
        guild_id: guild.id,
      },
    });

    if (config) {
      client.logger.info('A configuration was found!');
      client.guildConfigs.set(guild.id, config);
    } else {
      client.logger.info('A configuration was not found. Creating one!');
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
    }
  }
}
