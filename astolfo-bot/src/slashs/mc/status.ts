import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import BaseSlash from '../../utils/structures/BaseSlash';
import client from '../../client/client';
import { CommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import * as mc from 'minecraft-server-util';

const options = {
  timeout: 1000 * 5, // timeout in milliseconds
  enableSRV: true, // SRV record lookup
};

export default class McStatusEvent extends BaseSlash {
  constructor() {
    super('mcstatus');
  }

  async createInteraction(
    client: client,
    interaction: DiscordInteractions,
  ): Promise<void> {
    const command: PartialApplicationCommand = {
      name: 'mcstatus',
      description: 'mcstatus!',
    };

    await interaction
      .createApplicationCommand(command)
      .then(() => {
        client.logger.info('mcstatus command created!');
      })
      .catch(client.logger.error);
  }

  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    await interaction.deferReply().catch(client.logger.error);

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({
          size: 64,
        }),
      })
      .setTitle('Status');

    mc.status('40.68.145.3', 25565, options)
      .then((result) => {
        embed.addFields(
          {
            name: 'Server Status',
            value: 'Server is **Online!**',
          },
          {
            name: 'Players',
            value: `${result.players.online} / ${result.players.max}`,
          },
        );
        if (result.players.online > 0)
          embed.addFields({
            name: 'Who',
            value: result.players
              .sample!.map((player) => player.name)
              .reduce((agg, curr) => `${agg}${curr}\n `, ''),
          });
        interaction.editReply({ embeds: [embed] });
      })
      .catch((error) => {
        client.logger.error('test', error.message);
        return interaction.editReply(
          'It seems like the server is down, kinda sad...',
        );
      });
  }
}
