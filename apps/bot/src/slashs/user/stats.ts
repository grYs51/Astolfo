import {
  CacheType,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberSummary } from '../../stats/queries';
import { dashboardButton, dashboardUrlFor } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
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

    const me = guild.members.cache.get(interaction.user.id);
    const companionIds = summary.companions.slice(0, 3).map((c) => c.memberId);
    const companions = await cardMembers(guild, companionIds);
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
        companions: companionIds.map((id) => companions[id]),
      },
      THEMES[DEFAULT_THEME]
    );
    const dashboardUrl = dashboardUrlFor(guild.id);
    await InterActionUtils.send(
      interaction,
      {
        files: [await cardFile(svg, 'stats.png')],
        components: dashboardUrl ? [dashboardButton(dashboardUrl, 'Open your dashboard')] : [],
      },
      true
    );
  }
}
