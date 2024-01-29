import { CacheType, CommandInteraction } from 'discord.js';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';

export default class PingEvent extends BaseSlash {
  constructor() {
    super('ping', 'Shows the ping of the bot');
  }

  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! \`${ping}ms\``);
  }
}
