import { Events, Interaction } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';
import { slashCount } from '../../api/utils.ts/counter';

export default class InteractionCreateEvent extends BaseEvent {
  constructor() {
    super(Events.InteractionCreate);
  }

  protected event(client: DiscordClient, interaction: Interaction) {
    if (!interaction.isCommand()) return;
    const slash = client.slashs.get(interaction.commandName);
    if (!slash) return;
    slashCount(interaction.commandName);
    slash.run(client, interaction);
  }
}
