import { Events, Interaction, InteractionType } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  protected event(client: DiscordClient, interaction: Interaction) {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand: {
        const slash = client.slashs.get(interaction.commandName);
        if (!slash) return;
        slash.run(client, interaction);
        break;
      }
      case InteractionType.ModalSubmit:
      case InteractionType.MessageComponent: {
        // we no do that here
        if (interaction.isButton()) return;       
        const messageComponent = client.interactions.get(interaction.customId);
        if (!messageComponent) return;
        messageComponent.run(client, interaction);
        break;
      }
      default:
        break;
    }
  }
}