import { CommandInteraction, CacheType, SlashCommandBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';
import { Misc, platforms } from 'call-of-duty-api';
import logger from '../../utils/logger';
export default class MWAdd extends BaseSlash {
  override createInteraction(): any {
    return new SlashCommandBuilder()
      .setName(this.getName())
      .setDescription(this.getDescription())
      .addStringOption((option) =>
        option
          .setName('username')
          .setDescription('The username of the user')
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('platform')
          .setDescription('The platform of the user')
          .setRequired(true)
          .addChoices(
            { name: 'Battle.net', value: platforms.Battlenet },
            { name: 'Activision', value: platforms.Activision },
            { name: 'Steam', value: platforms.Steam },
          ),
      );
  }
  async run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    const username = interaction.options.get('username')?.value as string;
    const platform = interaction.options.get('platform')?.value as string;

    const mwUser = await Misc.search(
      username,
      platforms[platform as keyof typeof platforms] || platforms.Battlenet,
    );

    logger.info(mwUser);
  }
  constructor() {
    super('mwadd', 'Add a user to the database');
  }
}
