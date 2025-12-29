import humanizeDuration from 'humanize-duration';
import {
  CommandInteraction,
  CacheType,
  EmbedBuilder,
  SlashCommandBuilder,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
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

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT_MS = 60_000;

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

      const longestInVc = sortedLeaderboard[0]?.count ?? 1;

      const mapped = sortedLeaderboard.map((x) => ({
        ...x,
        time: humanizeDuration(x.count, { round: true }),
        bar: createBar(x.count, longestInVc, 15),
      }));

      const titleBase =
        type === 'current'
          ? leaderboardLabels[type].title
          : `${leaderboardLabels[type].title} - ${leaderboardTimeRangeLabels[timeRange]}`;

      const totalPages = Math.max(1, Math.ceil(mapped.length / PAGE_SIZE));

      const buildEmbed = (page: number) => {
        const start = page * PAGE_SIZE;
        const pageItems = mapped.slice(start, start + PAGE_SIZE);

        const embed = new EmbedBuilder()
          .setTitle(titleBase)
          .setDescription(leaderboardLabels[type].description)
          .setFooter({ text: `Page ${page + 1}/${totalPages}` });

        if (pageItems.length > 0) {
          embed.setFields(
            pageItems.map((x, i) => ({
              name: `${start + i + 1}. ${x.name}`,
              value: `${x.time}\n${x.bar}`,
            }))
          );
        } else {
          embed.setDescription(
            leaderboardLabels[type].empty ?? 'No data found'
          );
        }

        return embed;
      };

      const prevId = `leaderboard_prev_${interaction.id}`;
      const nextId = `leaderboard_next_${interaction.id}`;
      const closeId = `leaderboard_close_${interaction.id}`;

      const makeRow = (page: number) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(prevId)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page <= 0),
          new ButtonBuilder()
            .setCustomId(closeId)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(nextId)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages - 1)
        );

      let currentPage = 0;
      const initialEmbed = buildEmbed(currentPage);

      const sent = await InterActionUtils.send(interaction, {
        embeds: [initialEmbed],
        components: [makeRow(currentPage)],
        fetchReply: true,
      });

      if (!sent) return;

      const collector = sent.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          [prevId, nextId, closeId].includes(i.customId),
        componentType: ComponentType.Button,
        time: COLLECTOR_TIMEOUT_MS,
      });

      collector.on('collect', async (btn) => {
        try {
          if (btn.user.id !== interaction.user.id) {
            await btn.reply({
              content: 'Only the command user can use these buttons.',
              ephemeral: true,
            });
            return;
          }

          if (btn.customId === prevId) {
            currentPage = Math.max(0, currentPage - 1);
          } else if (btn.customId === nextId) {
            currentPage = Math.min(totalPages - 1, currentPage + 1);
          } else if (btn.customId === closeId) {
            collector.stop('closed');
            await btn.deferUpdate();
            return;
          }

          const updated = buildEmbed(currentPage);
          await InterActionUtils.update(btn, {
            embeds: [updated],
            components: [makeRow(currentPage)],
          });
        } catch (error) {
          Logger.error('Leaderboard collector', error);
        }
      });

      collector.on('end', async (_collected, _reason) => {
        void _reason;
        try {
          const disabledRow =
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(prevId)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(closeId)
                .setLabel('Close')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(nextId)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
            );

          await sent.edit({
            embeds: [buildEmbed(currentPage)],
            components: [disabledRow],
          });
        } catch (e) {
          void e;
        }
      });
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
