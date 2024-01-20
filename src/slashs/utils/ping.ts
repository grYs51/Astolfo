import { CacheType, CommandInteraction } from 'discord.js';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';

export default class PingEvent extends BaseSlash {
  constructor() {
    super('ping', 'Shows the ping of the bot');
  }

  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! \`${ping}ms\``);
  }

  async createInteraction(client: client, interaction: DiscordInteractions) {
    const command: PartialApplicationCommand = {
      name: this.getName(),
      description: this.getDescription(),
    };

    await interaction
      .createApplicationCommand(command, "1145313388923211886")
      .then(() => {
        client.logger.info('Ping command created!');
      })
      .catch(client.logger.error);
  }
}
