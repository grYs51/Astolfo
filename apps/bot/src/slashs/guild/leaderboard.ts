import {
  ChatInputCommandInteraction,
  CacheType,
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
import { Logger } from '../../utils/logger';
import { InterActionUtils } from '../../utils/interaction-utils';
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { leaderboardCard } from '../../cards/leaderboard.card';
import { cardFile } from '../../cards/render';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';
import { dashboardUrlFor, formatDuration } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';

const PAGE_SIZE = 10;
/** Buttons stop working after this long without a click */
const COLLECTOR_IDLE_MS = 60_000;

/** Dashboard period closest to each leaderboard time range */
const DASHBOARD_PERIOD: Record<LeaderboardTimeRanges, StatsPeriod> = {
  today: 'week',
  week: 'week',
  month: 'month',
  allTime: 'all',
};

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
    interaction: ChatInputCommandInteraction<CacheType>
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

      const totalPages = Math.max(1, Math.ceil(sortedLeaderboard.length / PAGE_SIZE));

      // Fetched once per member, so paging back and forth doesn't refetch
      const avatars = new Map<string, Promise<string | undefined>>();
      const avatarFor = (id: string) => {
        if (!avatars.has(id)) {
          avatars.set(id, fetchImage(guild.members.cache.get(id)?.displayAvatarURL(CARD_IMAGE)));
        }
        return avatars.get(id);
      };
      const serverIcon = fetchImage(guild.iconURL(CARD_IMAGE));

      const buildCard = async (page: number) => {
        const start = page * PAGE_SIZE;
        const pageItems = sortedLeaderboard.slice(start, start + PAGE_SIZE);
        const svg = leaderboardCard(
          {
            serverName: guild.name,
            serverIcon: await serverIcon,
            title: leaderboardLabels[type].title,
            subtitle: type === 'current' ? 'Right now' : leaderboardTimeRangeLabels[timeRange],
            footer: `${leaderboardLabels[type].description.replace('\n', ' ')} · Page ${page + 1}/${totalPages}`,
            empty: leaderboardLabels[type].empty ?? 'No data found',
            rows: await Promise.all(
              pageItems.map(async (x, i) => ({
                rank: start + i + 1,
                name: x.name,
                value: type === 'xp' ? `${x.count.toLocaleString('en-GB')} XP` : formatDuration(x.count),
                fraction: x.count / (longestInVc || 1),
                avatar: await avatarFor(x.id),
              }))
            ),
          },
          THEMES[DEFAULT_THEME]
        );
        return cardFile(svg, 'leaderboard.png');
      };

      const prevId = `leaderboard_prev_${interaction.id}`;
      const nextId = `leaderboard_next_${interaction.id}`;
      const closeId = `leaderboard_close_${interaction.id}`;

      const dashboardUrl = dashboardUrlFor(guild.id, {
        period: DASHBOARD_PERIOD[timeRange],
        tab: 'server',
      });

      // `ended`: the collector stopped, so every paging button is disabled
      const makeRow = (page: number, ended = false) => {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(prevId)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(ended || page <= 0),
          new ButtonBuilder()
            .setCustomId(closeId)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(ended),
          new ButtonBuilder()
            .setCustomId(nextId)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(ended || page >= totalPages - 1)
        );
        // Link buttons fire no interaction, so it keeps working after the collector ends
        if (dashboardUrl) {
          row.addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Dashboard').setURL(dashboardUrl)
          );
        }
        return row;
      };

      let currentPage = 0;

      const sent = await InterActionUtils.send(interaction, {
        files: [await buildCard(currentPage)],
        components: [makeRow(currentPage)],
        fetchReply: true,
      });

      if (!sent) return;

      // Everyone's clicks reach `collect`, so other people get an answer
      // instead of Discord's "This interaction failed"
      const collector = sent.createMessageComponentCollector({
        filter: (i) => [prevId, nextId, closeId].includes(i.customId),
        componentType: ComponentType.Button,
        idle: COLLECTOR_IDLE_MS,
      });

      collector.on('collect', async (btn) => {
        try {
          if (btn.user.id !== interaction.user.id) {
            await btn.reply({
              content: `Only ${interaction.user} can turn these pages. Run /leaderboard for your own.`,
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

          // Acknowledge first: a new page of avatars plus the render can take longer than Discord's 3s
          const page = currentPage;
          await InterActionUtils.deferUpdate(btn);
          const files = [await buildCard(page)];
          // A later click or the timeout got here first; don't overwrite its page or re-enable the buttons
          if (page !== currentPage || collector.ended) return;
          await InterActionUtils.editReply(btn, {
            files,
            // Drop the previous page's image instead of stacking them
            attachments: [],
            components: [makeRow(page)],
          });
        } catch (error) {
          Logger.error('Leaderboard collector', error);
        }
      });

      collector.on('end', async () => {
        try {
          await sent.edit({ components: [makeRow(currentPage, true)] });
        } catch {
          // The message may be gone; nothing to disable
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
  xp: {
    title: 'XP Leaderboard',
    description: 'XP from voice, messages, streaks and games',
    empty: 'Nobody has earned XP yet',
  },
  inactive: {
    title: 'Inactive Leaderboard',
    description: 'Time spend in voice channels\nwhile being muted or deafened',
    empty: 'No inactive users found',
  },
};
