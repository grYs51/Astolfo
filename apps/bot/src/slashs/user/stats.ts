import {
  CacheType,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { dashboardButton, dashboardUrlFor, PERIOD_CHOICES } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';
import { cardFile } from '../../cards/render';
import { statsCardSvg } from '../../cards/stats-card-svg';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

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
          .setChoices(...PERIOD_CHOICES)
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
    const svg = await statsCardSvg({
      db: client.dataSource,
      guildId: guild.id,
      memberId: interaction.user.id,
      viewerId: interaction.user.id,
      period,
      theme: THEMES[DEFAULT_THEME],
    });
    const dashboardUrl = dashboardUrlFor(guild.id, { period });
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
