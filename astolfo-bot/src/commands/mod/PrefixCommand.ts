import { Message } from 'discord.js';
import BaseCommand from '../../utils/structures/BaseCommand';
import DiscordClient from '../../client/client';

export default class PrefixCommand extends BaseCommand {
  constructor() {
    super('prefix', 'mod', []);
  }

  async run(client: DiscordClient, message: Message, args: Array<string>) {
    if (!args.length) {
      message.channel.send('Please provide an argument!');
      return;
    }

    const [newPrefix] = args;
    try {
      const config = client.configs.get(message.guildId!);
      const updatedConfig = await client.dataSource.guildConfigurations.save({
        ...config,
        prefix: newPrefix,
      });
      client.configs.set(message.guildId!, updatedConfig);
      message.channel.send('Update prefix succesfully');
    } catch (e) {
      console.log(e);
      message.channel.send('Something went wrong!');
    }
  }
}
