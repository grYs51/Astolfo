import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class WelcomechannelCommand extends BaseCommand {
  constructor() {
    super('welcomechannel', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (!args.length) {
      message.channel.send('Please provide an channel id');
      return;
    }

    const channel = message.guild?.channels.cache.get(args[0]);
    if (!channel || channel.guildId != message.guildId) {
      message.channel.send('Please provide an valid channel id');
      return;
    }

    const [newChannelId] = args;
    try {
      const updatedConfig = await client.dataSource.guildConfigurations.update({
        data: {
          welcome_channel_id: newChannelId,
        },
        where: {
          guild_id: message.guildId!,
        },
      });
      client.guildConfigs.set(message.guildId!, updatedConfig);
      message.react('✅');
    } catch (e) {
      client.logger.error(e);
      message.react('❌');
    }
  }
}
