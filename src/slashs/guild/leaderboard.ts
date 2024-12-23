import humanizeDuration from 'humanize-duration';
import {
  CommandInteraction,
  CacheType,
  EmbedBuilder,
  SlashCommandBuilder,
  InteractionContextType,
} from 'discord.js';
import client from '../../client/client';
import { BaseSlash } from '../../utils/structures/base-slash';
import {
  LeaderboardTimeRanges,
  LeaderboardTypes,
  getLeaderboard,
  leaderboardTimeRangeLabels,
  leaderboardTypesLabels,
} from '../../utils/functions/leaderboard/leaderboard';
import { createBar } from '../../utils/functions/create-bar';
import { Logger } from '../../utils/logger';

export default class LeaderboardEvent extends BaseSlash {
  constructor() {
    super('leaderboard', 'Shows a leaderboard of the most active users');
  }

  override createInteraction(client: client) {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('The Leaderboard Type')
          .addChoices(
            ...Object.entries(leaderboardTypesLabels).map(([value, name]) => ({
              name,
              value,
            }))
          )
      )
      .addStringOption((option) =>
        option
          .setName('time-range')
          .setDescription('Time Range of data')
          .addChoices(
            ...Object.entries(leaderboardTimeRangeLabels).map(
              ([value, name]) => ({ name, value })
            )
          )
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(
    client: client,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction
        .reply({
          content: 'This command can only be used in a server.',
        })
        .catch(Logger.error);
      return;
    }

    const type =
      (interaction.options.get('type')?.value as LeaderboardTypes) ?? 'active';
    const timeRange =
      (interaction.options.get('time-range')?.value as LeaderboardTimeRanges) ??
      'allTime';

    await interaction.deferReply().catch(Logger.error);

    const leaderboard = await getLeaderboard(client, guild.id, type, timeRange);

    if (!leaderboard) {
      await interaction.editReply('no data');
      return;
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
      .setDescription(`Time spend in voice channels`)
      .addFields(
        sorted.map((x, i) => {
          return {
            name: `${i + 1}. ${x.name}`,
            value: `${x.time}\n${x.bar}`,
          };
        })
      );

    await interaction.editReply({ embeds: [embed] }).catch(Logger.error);
  }
}
