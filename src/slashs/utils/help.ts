import {
  APIEmbedField,
  CacheType,
  CommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import BaseSlash from '../../utils/structures/BaseSlash';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import client from '../../client/client';

export default class HelpEvent extends BaseSlash {
  async createInteraction(
    client: client,
    interaction: DiscordInteractions,
  ): Promise<void> {
    const command: PartialApplicationCommand = {
      name: this.getName(),
      description: this.getDescription(),
    };

    await interaction
      .createApplicationCommand(command, '1145313388923211886')
      .then(() => {
        client.logger.info('Help command created!');
      })
      .catch(client.logger.error);
  }

  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {

    const fields: APIEmbedField[] = client.slashs.map((slash) => {
      return {
        name: slash.getName(),
        value: slash.getDescription(),
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
