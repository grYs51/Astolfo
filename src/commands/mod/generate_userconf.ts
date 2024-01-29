import { Message } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseCommand from '../../utils/structures/BaseCommand';

export default class GenerateUserconfCommand extends BaseCommand {
  constructor() {
    super('generate_userconf', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (message.author.id != client.ownerId) {
      message.react('⛔');
      return;
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

      message.react('✅');
      return;
    } catch (e) {
      client.logger.error(e);
      message.react('❌');
      return;
    }
  }
}
