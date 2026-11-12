import { CacheType, ChatInputCommandInteraction, escapeMarkdown, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getTriviaStats } from '../../trivia/stats';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { triviaStatsCard } from '../../cards/trivia.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

/** /trivia-stats [member] — someone's trivia in this server. Public, like /duo; refusals only you see. */
export default class TriviaStatsSlash extends BaseSlash {
  constructor() {
    super('trivia-stats', 'Trivia answers, 1st places and XP of you or another member', SlashDeferTypes.PUBLIC);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addUserOption((option) => option.setName('member').setDescription('Someone else (optional)').setRequired(false))
      .setContexts(InteractionContextType.Guild);
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    if (!interaction.inCachedGuild()) {
      await InterActionUtils.send(interaction, 'Use /trivia-stats in a server.', true);
      return;
    }
    const picked = interaction.options.getUser('member');
    // getMember is null for someone who left the server, so their old stats aren't posted
    const member = picked ? interaction.options.getMember('member') : interaction.member;
    if (!member || member.user.bot) {
      await InterActionUtils.send(interaction, 'Pick a member of this server (not a bot).', true);
      return;
    }

    const guild = interaction.guild;
    const stats = await getTriviaStats(client.dataSource, guild.id, member.id);
    if (!stats.answered) {
      const who = member.id === interaction.user.id ? 'You have' : `${escapeMarkdown(member.displayName)} has`;
      await InterActionUtils.send(interaction, { content: `${who} no trivia answers here yet. Try /trivia!`, allowedMentions: { parse: [] } });
      return;
    }
    const { [member.id]: card } = await cardMembers(guild, [member.id]);
    const svg = triviaStatsCard({ name: card?.name ?? member.displayName, avatar: card?.avatar, serverName: guild.name, stats }, THEMES[DEFAULT_THEME]);
    await InterActionUtils.send(interaction, { files: [await cardFile(svg, 'trivia-stats.png')] });
  }
}
