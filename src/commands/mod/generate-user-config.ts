import { Message } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseCommand from '../../utils/structures/base-command';

export default class GenerateUserConfig extends BaseCommand {
  constructor() {
    super('generate_userconfigs', 'mod', ['guc']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      return message.react('⛔');
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

      return message.react('✅');
    } catch (e) {
      client.logger.error(e);
      return message.react('❌');
    }
  }
}
