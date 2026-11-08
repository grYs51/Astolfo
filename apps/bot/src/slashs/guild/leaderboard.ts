import humanizeDuration from 'humanize-duration';
import {
  ChatInputCommandInteraction,
  CacheType,
  EmbedBuilder,
  SlashCommandBuilder,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
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
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { leaderboardCard } from '../../cards/leaderboard.card';
import { renderPng } from '../../cards/render';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';
import { formatDuration } from '../../stats/messages';

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
      .addBooleanOption((option) =>
        option
          .setName('image')
          .setDescription('Show it as an image card')
          .setRequired(false)
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
    const image = interaction.options.getBoolean('image') ?? false;

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

      // Fetched once per member, so paging back and forth doesn't refetch
      const avatars = new Map<string, Promise<string | undefined>>();
      const avatarFor = (id: string) => {
        if (!avatars.has(id)) {
          avatars.set(id, fetchImage(guild.members.cache.get(id)?.displayAvatarURL(CARD_IMAGE)));
        }
        return avatars.get(id);
      };
      const serverIcon = image ? fetchImage(guild.iconURL(CARD_IMAGE)) : undefined;

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
                value: formatDuration(x.count),
                fraction: x.count / (longestInVc || 1),
                avatar: await avatarFor(x.id),
              }))
            ),
          },
          THEMES[DEFAULT_THEME]
        );
        return new AttachmentBuilder(await renderPng(svg), { name: 'leaderboard.png' });
      };

      const buildPage = async (page: number) =>
        image ? { embeds: [], files: [await buildCard(page)] } : { embeds: [buildEmbed(page)] };

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

      const sent = await InterActionUtils.send(interaction, {
        ...(await buildPage(currentPage)),
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

          if (!image) {
            await InterActionUtils.update(btn, {
              embeds: [buildEmbed(currentPage)],
              components: [makeRow(currentPage)],
            });
            return;
          }

          // Acknowledge first: a new page of avatars plus the render can take longer than Discord's 3s
          const page = currentPage;
          await InterActionUtils.deferUpdate(btn);
          const files = [await buildCard(page)];
          // A later click or the timeout got here first; don't overwrite its page or re-enable the buttons
          if (page !== currentPage || collector.ended) return;
          await InterActionUtils.editReply(btn, {
            embeds: [],
            files,
            // Drop the previous page's image instead of stacking them
            attachments: [],
            components: [makeRow(page)],
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

          await sent.edit({ components: [disabledRow] });
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
