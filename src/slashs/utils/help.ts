import {
  APIEmbedField,
  CacheType,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import BaseSlash from '../../utils/structures/base-slash';
import client from '../../client/client';

export default class HelpEvent extends BaseSlash {
  async slash(
    client: client,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const fields: APIEmbedField[] = client.slashs.map((slash) => {
      return {
        name: slash.name,
        value: slash.description,
      };
    });

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({
          size: 64,
        }),
      })
      .setTitle('Help')
      .setDescription('All the commands')
      .addFields(fields);

    await interaction.reply({
      embeds: [embed],
    });
  }
  constructor() {
    super('help', 'Shows all the commands');
  }
}
