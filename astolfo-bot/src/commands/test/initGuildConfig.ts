import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import process from 'process';

export default class InitConfigs extends BaseCommand {
  constructor() {
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
        const newConfig = client.dataSource.guildConfigurations.create({
          guildId: guild.id,
        });

        const savedConfig = await client.dataSource.guildConfigurations.save(
          newConfig,
        );
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
