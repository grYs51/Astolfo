import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import logger from '../../utils/logger';

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
      client.guilds.cache.forEach(async (guild) => {
        if (client.guildConfigs.has(guild.id)) return;

        logger.info(`Initializing guild ${guild.name} (${guild.id})`);
        client.dataSource.guildConfigurations
          .upsert({
            where: {
              guild_id: guild.id,
            },
            update: {},
            create: {
              guild_id: guild.id,
              prefix: '!',
            },
          })
          .then((config) => {
            client.guildConfigs.set(config.guild_id, config);
          });
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
