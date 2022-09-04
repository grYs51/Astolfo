// https://discord.js.org/#/docs/main/stable/class/Client?scrollTo=e-guildCreate
import { Guild } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { GuildConfiguration } from '../../typeOrm/entities/GuildConfiguration';
import { Repository } from 'typeorm';
import { AppdataSource } from '../..';

export default class GuildCreateEvent extends BaseEvent {
  constructor(
    private readonly guildConfigRepository: Repository<GuildConfiguration> = AppdataSource.getRepository(
      GuildConfiguration,
    ),
  ) {
    super('guildCreate');
  }

  async run(client: DiscordClient, guild: Guild) {
    const config = await this.guildConfigRepository.findOneBy({
      guildId: guild.id,
    });

    if (config) {
      console.log('A configuration was found!');
      client.configs.set(guild.id, config);
    } else {
      console.log('A configuration was not found. Creating one!');
      const newConfig = this.guildConfigRepository.create({
        guildId: guild.id,
      });

      const savedConfig = await this.guildConfigRepository.save(newConfig);
      client.configs.set(guild.id, savedConfig);
    }
  }
}
