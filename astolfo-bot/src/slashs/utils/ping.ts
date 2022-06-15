import {
  CacheType,
  CommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';

export default class PingEvent extends BaseSlash {
  constructor() {
    super('ping');
  }

  async run(client: client, interaction: CommandInteraction<CacheType>): Promise<void> {
    interaction.reply('Pong!');
  }

  async createInteraction(client: client, interaction: DiscordInteractions) {
    const command: PartialApplicationCommand = {
      name: 'ping',
      description: 'Ping!',
    };

    await interaction
      .createApplicationCommand(command)
      .then(() => {
        console.log('Ping command created!');
      })
      .catch(console.error);
  }
}
