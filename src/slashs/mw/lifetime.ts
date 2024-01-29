import { CommandInteraction, CacheType } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';

export default class MWLifetime extends BaseSlash {
  async run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    await interaction.reply('pong!');
  }

  constructor() {
    super('mwlifetime', 'Get your lifetime stats');
  }
}
