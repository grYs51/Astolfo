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
import { InterActionUtils } from '../../utils/interaction-utils';

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
          .setRequired(false)
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
          .setRequired(false)
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

    await InterActionUtils.deferReply(interaction);

    try {
      const leaderboard = await getLeaderboard(
        client,
        guild.id,
        type,
        timeRange
      );

      if (!leaderboard) {
        await InterActionUtils.send(
          interaction,
          leaderboardLabels[type].empty ?? 'No data found',
          true
        );
        return;
      }

      const sortedLeaderboard = leaderboard.toSorted(
        (a, b) => b.count - a.count
      );

      const longestInVc = sortedLeaderboard[0].count;

      const sorted = sortedLeaderboard.map((x) => {
        return {
          ...x,
          time: humanizeDuration(x.count, { round: true }),
          bar: createBar(x.count, longestInVc, 15),
        };
      });

      const title =
        type === 'current'
          ? leaderboardLabels[type].title
          : `${leaderboardLabels[type].title} - ${leaderboardTimeRangeLabels[timeRange]}`;

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(title)
        .setDescription(leaderboardLabels[type].description)
        .setFields(
          sorted.map((x, i) => ({
            name: `${i + 1}. ${x.name}`,
            value: `${x.time}\n${x.bar}`,
          }))
        );

      await InterActionUtils.send(interaction, embed);
    } catch (error) {
      Logger.error('Leaderboard', error);
      await InterActionUtils.send(
        interaction,
        'An error occurred while fetching the leaderboard'
      );
    }
  }
}

const leaderboardLabels: Record<
  LeaderboardTypes,
  { title: string; description: string; empty?: string }
> = {
  active: {
    title: 'Active Leaderboard',
    description:
      'Time spend in voice channels\nwithout being muted or deafened',
    empty: 'No active users found',
  },
  current: {
    title: 'Current Leaderboard',
    description: 'Current time spend in voice channels',
    empty: 'No one is currently in a voice channel',
  },
  loner: {
    title: 'Loner Leaderboard',
    description: 'Time spend in voice channels alone',
    empty: 'No loners found',
  },
  inactive: {
    title: 'Inactive Leaderboard',
    description: 'Time spend in voice channels\nwhile being muted or deafened',
    empty: 'No inactive users found',
  },
};
