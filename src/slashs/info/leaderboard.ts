import humanizeDuration from 'humanize-duration';
import { CommandInteraction, CacheType, EmbedBuilder } from 'discord.js';
import DiscordInteractions, { PartialApplicationCommand } from 'slash-commands';
import client from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';
import {
  getLeaderboard,
  getLeaderboardActive,
} from '../../utils/functions/leaderboard';
import { createBar } from '../../utils/functions/CreateBar';
import { guild_stats } from '@prisma/client';

export default class LeaderboardEvent extends BaseSlash {
  constructor() {
    super('leaderboard', 'Shows a leaderboard of the most active users');
  }

  async createInteraction(
    client: client,
    interaction: DiscordInteractions,
  ): Promise<void> {
    const command: PartialApplicationCommand = {
      name: this.getName(),
      description: this.getDescription(),
      options: [
        {
          name: 'all-time',
          description: 'Show all time stats',
          type: 1,
        },
        {
          name: 'current',
          description: 'Show current users in voice channels',
          type: 1,
        },
      ],
    };

    await interaction
      .createApplicationCommand(command, "1145313388923211886")
      .then(() => {
        client.logger.info('Leaderboard command created!');
      })
      .catch(client.logger.error);
  }
  async run(
    client: client,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction
        .reply({
          content: 'This command can only be used in a server.',
        })
        .catch(client.logger.error);
      return;
    }

    const type = interaction.options.data.find((o) => o.name === 'all-time');

    await interaction.deferReply().catch(client.logger.error);

    const stats = type
      ? await client.dataSource.guildStats.findMany({
          where: {
            guild_id: guild.id,
          },
        })
      : [];

    const inChannel = client.voiceUsers.filter((x) => x.guild_id === guild.id);

    if (!stats.length && !inChannel.length) {
      await interaction.editReply({
        content: type ? 'No stats found!' : 'No one is in a voice channel!',
      });
      return;
    }

    const leaderboard = getLeaderboard(client, stats, guild.id);

    if (inChannel) {
      getLeaderboardActive(client, guild.id, inChannel as guild_stats[], leaderboard);
    }

    const longestInVc = leaderboard
      .sort((a, b) => b.count - a.count)
      .slice(0, 1)[0].count;

    const sorted = leaderboard
      .sort((a, b) => {
        return b.count - a.count;
      })
      .map((x) => {
        return {
          ...x,
          time: humanizeDuration(x.count, { round: true }),
          bar: createBar(x.count, longestInVc, 20),
        };
      });

    const embed = new EmbedBuilder()
      .setColor('#000000')
      .setTitle('Leaderboard')
      .setDescription('Time spend in voice channels')
      .addFields(
        sorted.map((x, i) => {
          return {
            name: `${i + 1}. ${x.name}`,
            value: `${x.time}\n${x.bar}`,
          };
        }),
      );

    await interaction.editReply({ embeds: [embed] }).catch(client.logger.error);
  }
}
