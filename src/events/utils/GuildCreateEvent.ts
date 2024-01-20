// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildCreate
import { Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { Repository } from 'typeorm';

export default class GuildCreateEvent extends BaseEvent {
  constructor() {
    super('guildCreate');
  }

  async run(client: DiscordClient, guild: Guild) {
    const config = await client.dataSource.guildConfigurations.findOneBy({
      guildId: guild.id,
    });

    if (config) {
      client.logger.info('A configuration was found!');
      client.configs.set(guild.id, config);
    } else {
      client.logger.info('A configuration was not found. Creating one!');
      const newConfig = client.dataSource.guildConfigurations.create({
        guildId: guild.id,
      });

      const savedConfig = await client.dataSource.guildConfigurations.save(
        newConfig,
      );
      client.configs.set(guild.id, savedConfig);
    }
  }
}
