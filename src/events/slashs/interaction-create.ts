import { Events, Interaction } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  protected event(client: DiscordClient, interaction: Interaction) {
    if (!interaction.isCommand()) return;
    const slash = client.slashs.get(interaction.commandName);
    if (!slash) return;
    slash.run(client, interaction);
  }
}
