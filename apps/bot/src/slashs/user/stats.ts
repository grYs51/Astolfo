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
import { buildStatsMessage, dashboardUrlFor } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';

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
