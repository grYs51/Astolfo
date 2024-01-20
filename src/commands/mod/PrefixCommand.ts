import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class PrefixCommand extends BaseCommand {
  constructor() {
    super('prefix', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    const config = client.configs.get(message.guildId!);

    if (!args.length) {
      message.channel.send(
        `Please provide an prefix\nUsage: \`${
          config?.prefix || '!'
        }prefix <new prefix>\``,
      );
      return;
    }

    const [newPrefix] = args;
    try {
      const updatedConfig = await client.dataSource.guildConfigurations.update({
        data: {
          prefix: newPrefix,
        },
        where: {
          guild_id: message.guildId!,
        },
      });
      client.configs.set(message.guildId!, updatedConfig);
      message.react('✅');
    } catch (e) {
      client.logger.error(e);
      message.react('❌');
    }
  }
}
