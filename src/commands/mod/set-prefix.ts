import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { MessageUtils } from '../../utils/message-utils';

export default class SetPrefixCommand extends BaseCommand {
  constructor() {
    super('setprefix', 'mod', ['sp']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    const config = client.guildConfigs.get(message.guildId!);

    if (!args.length) {
      return MessageUtils.reply(
        message,
        `Please provide an prefix\nUsage: \`${
          config?.prefix ?? ','
        }prefix <new prefix>\``
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
        return MessageUtils.react(message, '✅');
      })
      .catch((e) => {
        Logger.error(e);
        return MessageUtils.react(message, '💥');
      });
  }
}
