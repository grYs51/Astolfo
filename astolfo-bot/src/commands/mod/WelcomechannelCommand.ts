import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';
import { GuildConfiguration } from '../../typeOrm/entities/GuildConfiguration';
import AppdataSource from '../..';

export default class WelcomechannelCommand extends BaseCommand {
  constructor(
    private readonly guildConfigRepository = AppdataSource.getRepository(
      GuildConfiguration,
    ),
  ) {
    super('welcomechannel', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (!args.length) {
      message.channel.send('Please provide an argument!');
      return;
    }

    const [newChannelId] = args;
    try {
      const config = client.configs.get(message.guildId!);
      const updatedConfig = await this.guildConfigRepository.save({
        ...config,
        welcomeChannelId: newChannelId,
      });
      client.configs.set(message.guildId!, updatedConfig);
      message.channel.send('Update Welcome Channel succesfully');
    } catch (e) {
      console.log(e);
      message.channel.send('Something went wrong!');
    }
  }
}
