import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class PrefixCommand extends BaseCommand {
  constructor() {
    super('prefix', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    const config = client.guildConfigs.get(message.guildId!);

    if (!args.length) {
      return message.reply(
        `Please provide an prefix\nUsage: \`${
          config?.prefix || '!'
        }prefix <new prefix>\``,
      );
    }

    const [newPrefix] = args;
    return client.dataSource.guildConfigurations
      .update({
        data: {
          prefix: newPrefix,
        },
        where: {
          guild_id: message.guildId!,
        },
      })
      .then((updatedConfig) => {
        client.guildConfigs.set(message.guildId!, updatedConfig);
        return message.react('✅');
      })
      .catch((e) => {
        client.logger.error(e);
        return message.react('❌');
      });
  }
}
