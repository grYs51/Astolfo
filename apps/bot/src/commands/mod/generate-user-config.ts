import { Message } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseCommand from '../../utils/structures/base-command';
import { Logger } from '../../utils/logger';
import { MessageUtils } from '../../utils/message-utils';

export default class GenerateUserConfig extends BaseCommand {
  constructor() {
    super('generate_userconfigs', 'mod', ['guc']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id !== client.ownerId) {
      return MessageUtils.react(message, '⛔');
    }

    try {
      client.guilds.cache.forEach(async (guild) => {
        guild.members.cache.forEach(async (member) => {
          if (client.userConfigs.has(member.id)) return;
          client.dataSource.userConfigs
            .upsert({
              where: {
                user_id: member.id,
              },
              update: {},
              create: {
                user_id: member.id,
              },
            })
            .then((config) => {
              client.userConfigs.set(config.user_id, config);
            });
        });
      });

      return MessageUtils.react(message, '✅');
    } catch (e) {
      Logger.error('Error initializing users', e);
      return MessageUtils.react(message, '💥');
    }
  }
}
