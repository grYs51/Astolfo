import { Events, Interaction } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';

export default class ModalSubmitEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  async event(client: DiscordClient, interaction: Interaction) {
    if (!interaction.isModalSubmit()) return;
    interaction.reply({ content: 'Lol, gay', ephemeral: true });
  }
  getGuildId(client, interaction: Interaction) {
    return interaction.guild?.id || 'DM';
  }
  getUserId(clientient, interaction: Interaction) {
    return interaction.user.id;
  }
}
