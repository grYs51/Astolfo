import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/base-command';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { MessageUtils } from '../../utils/message-utils';

export default class SetWelcomeChannelCommand extends BaseCommand {
  constructor() {
    super('setwelcomechannel', 'mod', ['swc']);
  }

  async command(client: DiscordClient, message: Message, args: Array<string>) {
    if (!args.length) {
      return message.reply('Please provide an channel id');
    }

    const channel = message.guild?.channels.cache.get(args[0]);
    if (!channel || channel.guildId != message.guildId) {
      return MessageUtils.reply(message, 'Please provide an valid channel id');
    }

    const [newChannelId] = args;
    return client.dataSource.guildConfigurations
      .update({
        data: {
          welcome_channel_id: newChannelId,
        },
        where: {
          guild_id: message.guildId,
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
