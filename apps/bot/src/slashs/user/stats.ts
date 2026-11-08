import {
  AttachmentBuilder,
  CacheType,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberSummary } from '../../stats/queries';
import { buildStatsMessage, dashboardButton, dashboardUrlFor } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { renderPng } from '../../cards/render';
import { statsCard } from '../../cards/stats.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

const PERIODS: { name: string; value: StatsPeriod }[] = [
  { name: 'Past week', value: 'week' },
  { name: 'Past month', value: 'month' },
  { name: 'Past year', value: 'year' },
  { name: 'All time', value: 'all' },
];

/**
 * /stats [period] — your own voice and message summary on this server, with
 * a link to the dashboard. Only you see the reply.
 */
export default class StatsSlash extends BaseSlash {
  constructor() {
    super('stats', 'Your voice and message stats on this server', SlashDeferTypes.HIDDEN);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName('period')
          .setDescription('Which period (default: past month)')
          .setRequired(false)
          .setChoices(...PERIODS)
      )
      .addBooleanOption((option) =>
        option.setName('image').setDescription('Show it as an image card').setRequired(false)
      )
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    const guild = interaction.guild;
    if (!guild) {
      await InterActionUtils.send(interaction, 'Use /stats in a server.', true);
      return;
    }

    const period = (interaction.options.get('period')?.value as StatsPeriod | undefined) ?? 'month';
    const summary = await getMemberSummary(client.dataSource, guild.id, interaction.user.id, period);

    if (interaction.options.getBoolean('image')) {
      const me = guild.members.cache.get(interaction.user.id);
      const companions = summary.companions.slice(0, 3).map((c) => guild.members.cache.get(c.memberId));
      const svg = statsCard(
        {
          summary,
          period,
          memberName: me?.displayName ?? interaction.user.displayName,
          avatar: await fetchImage((me ?? interaction.user).displayAvatarURL(CARD_IMAGE)),
          serverName: guild.name,
          favouriteChannelName: summary.favouriteChannelId
            ? guild.channels.cache.get(summary.favouriteChannelId)?.name
            : undefined,
          companions: await Promise.all(
            companions.map(async (m) => ({
              name: m?.displayName ?? 'Unknown member',
              avatar: await fetchImage(m?.displayAvatarURL(CARD_IMAGE)),
            }))
          ),
        },
        THEMES[DEFAULT_THEME]
      );
      const dashboardUrl = dashboardUrlFor(guild.id);
      await InterActionUtils.send(
        interaction,
        {
          files: [new AttachmentBuilder(await renderPng(svg), { name: 'stats.png' })],
          components: dashboardUrl ? [dashboardButton(dashboardUrl, 'Open your dashboard')] : [],
        },
        true
      );
      return;
    }

    await InterActionUtils.send(
      interaction,
      buildStatsMessage({
        summary,
        period,
        guildName: guild.name,
        dashboardUrl: dashboardUrlFor(guild.id),
      }),
      true
    );
  }
}
