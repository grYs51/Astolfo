import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class InitConfigs extends BaseCommand {
  constructor() {
    super('configs', 'testing', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      message.react('⛔');
      return;
    }

    try {
      client.logger.info('A configuration was not found. Creating one!');
      client.guilds.cache.forEach(async (guild) => {
        client.logger.info('A configuration was not found. Creating one!');
        const newConfig = client.dataSource.guildConfigurations.create({
          guildId: guild.id,
        });

        const savedConfig = await client.dataSource.guildConfigurations.save(
          newConfig,
        );
        client.configs.set(guild.id!, savedConfig);
      });
    } catch (e) {
      client.logger.error(e);
      message.react('❌');
      return;
    }

    message.react('✅');
    return;
  }
}
