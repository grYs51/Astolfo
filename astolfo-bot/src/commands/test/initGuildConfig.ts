import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import process from 'process';
import { Repository } from 'typeorm';
import { GuildConfiguration } from '../../typeOrm/entities/GuildConfiguration';
import { AppdataSource } from '../..';

export default class InitConfigs extends BaseCommand {
  constructor(
    private readonly guildConfigRepository: Repository<GuildConfiguration> = AppdataSource.getRepository(
      GuildConfiguration,
    ),
  ) {
    super('configs', 'testing', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != process.env.OWNER) {
      message.react('⛔');
      return;
    }

    try {
      console.log('A configuration was not found. Creating one!');
      client.guilds.cache.forEach(async (guild) => {
        console.log('A configuration was not found. Creating one!');
        const newConfig = this.guildConfigRepository.create({
          guildId: guild.id,
        });

        const savedConfig = await this.guildConfigRepository.save(newConfig);
        client.configs.set(guild.id!, savedConfig);
      });
    } catch (e) {
      message.react('❌');
      return;
    }

    message.react('✅');
    return;
  }
}
