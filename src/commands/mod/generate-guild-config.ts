import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import logger from '../../utils/logger';

export default class GenerateGuildConfigs extends BaseCommand {
  constructor() {
    super('generate_guildconfigs', 'testing', ['ggc']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return message.react('⛔');
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
      return message.react('❌');
    }

    return message.react('✅');
  }
}
