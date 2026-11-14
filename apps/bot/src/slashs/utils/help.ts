import {
  APIEmbedField,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BaseSlash } from '../../utils/structures/base-slash';
import client from '../../client/client';
import { dashboardButton, dashboardUrlFor } from '../../stats/messages';

export default class HelpEvent extends BaseSlash {
  async slash(
    client: client,
    interaction: ChatInputCommandInteraction<CacheType>
  ): Promise<void> {
    const fields: APIEmbedField[] = client.slashs.map((slash) => {
      return {
        name: `/${slash.name}`,
        value: slash.description,
      };
    });
    // Only in a server: the dashboard is per server
    const dashboardUrl = interaction.guildId ? dashboardUrlFor(interaction.guildId) : undefined;

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({
          size: 64,
        }),
      })
      .setTitle('Help')
      .setDescription(
        dashboardUrl
          ? 'All the commands. Charts, leaderboards and your full history are on the dashboard.'
          : 'All the commands'
      )
      .addFields(fields);

    await interaction.reply({
      embeds: [embed],
      components: dashboardUrl ? [dashboardButton(dashboardUrl, 'Open the dashboard')] : [],
      // Only the asker needs the list; no need to fill the channel with it
      ephemeral: true,
    });
  }
  constructor() {
    super('help', 'Shows all the commands');
  }
}
