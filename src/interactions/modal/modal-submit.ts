import { CacheType, ModalSubmitInteraction } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseInteraction from '../../utils/structures/base-interaction';

export default class ModalSubmitEvent extends BaseInteraction {
  constructor() {
    super('myModal');
  }

  async run(client: DiscordClient, interaction:  ModalSubmitInteraction<CacheType>) {
    console.log(interaction);

    console.log(interaction.fields.fields.map((field) => field.value));
    

    return interaction.reply({
      content: "i'm a modal submit",
      ephemeral: true,
    });
  }
}
