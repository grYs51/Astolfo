import { Events, Interaction, InteractionResponse } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';

export default class ModalSubmitEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  async run(client, interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    interaction.reply({ content: 'Lol, gay', ephemeral: true });
  }
}
