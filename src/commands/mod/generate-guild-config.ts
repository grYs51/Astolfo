import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { MessageUtils } from '../../utils/message-utils';

export default class GenerateGuildConfigs extends BaseCommand {
  constructor() {
    super('generate_guildconfigs', 'testing', ['ggc']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return MessageUtils.react(message, '❌');
    }

    try {
      client.guilds.cache.forEach(async (guild) => {
        if (client.guildConfigs.has(guild.id)) return;

        Logger.info(`Initializing guild ${guild.name} (${guild.id})`);
        client.dataSource.guildConfigurations
          .upsert({
            where: {
              guild_id: guild.id,
            },
            update: {},
            create: {
              guild_id: guild.id,
              prefix: process.env.PREFIX ?? ',',
            },
          })
          .then((config) => {
            client.guildConfigs.set(config.guild_id, config);
          });
      });
    } catch (e) {
      Logger.error('Error initializing guilds', e);
      return MessageUtils.react(message, '💥');
    }

    return MessageUtils.react(message, '✅');
  }
}
