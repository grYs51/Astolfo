import {
  CommandInteraction,
  CacheType,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import BaseSlash from '../../utils/structures/BaseSlash';
import client from '../../client/client';
import { ModalBuilder } from '@discordjs/builders';

export default class Modal extends BaseSlash {
  constructor() {
    super('modal', 'Shows a modal');
  }

  async createInteraction(client: client, interaction: DiscordInteractions) {
    const command: PartialApplicationCommand = {
      name: this.getName(),
      description: this.getDescription(),
    };

    await interaction
      .createApplicationCommand(command, "1145313388923211886")
      .then(() => {
        client.logger.info('Modal command created!');
      })
      .catch(client.logger.error);
  }

  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('myModal')
      .setTitle('My Modal');

    // Add components to modal

    // Create the text input components
    const favoriteColorInput = new TextInputBuilder()
      .setCustomId('favoriteColorInput')
      // The label is the prompt the user sees for this input
      .setLabel("What's your favorite color?")
      // Short means only a single line of text
      .setStyle(TextInputStyle.Short);

    const hobbiesInput = new TextInputBuilder()
      .setCustomId('hobbiesInput')
      .setLabel("What's some of your favorite hobbies?")
      // Paragraph means multiple lines of text.
      .setStyle(TextInputStyle.Paragraph);

    // An action row only holds one text input,
    // so you need one action row per text input.
    const firstActionRow = new ActionRowBuilder().addComponents(
      favoriteColorInput,
    );
    const secondActionRow = new ActionRowBuilder().addComponents(hobbiesInput);

    // Add inputs to the modal
    modal.addComponents(firstActionRow as any, secondActionRow);

    interaction.showModal(modal);
  }
}
