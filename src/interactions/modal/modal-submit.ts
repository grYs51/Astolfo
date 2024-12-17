import { CacheType, ModalSubmitInteraction } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseInteraction from '../../utils/structures/base-interaction';

export default class ModalSubmitEvent extends BaseInteraction {
  constructor() {
    super('myModal');
  }

  async run(
    client: DiscordClient,
    interaction: ModalSubmitInteraction<CacheType>
  ) {
    return interaction.reply({
      content: "i'm a modal submit",
      ephemeral: true,
    });
  }
}
