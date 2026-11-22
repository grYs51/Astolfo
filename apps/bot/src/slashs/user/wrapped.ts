import { CacheType, ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { getMemberWrapped } from '../../stats/queries';
import { dashboardButton, dashboardUrl } from '../../stats/messages';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';
import { wrappedCard } from '../../cards/wrapped.card';
import { discordDirectory } from '../../api/utils/discord-directory';

/** /wrapped [member] [year] — a member's year on the server as a card (UTC year, the current one by default) */
export default class WrappedSlash extends BaseSlash {
  constructor() {
    super('wrapped', 'Your year on this server, Wrapped style', SlashDeferTypes.PUBLIC);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setContexts(InteractionContextType.Guild)
      .addUserOption((option) => option.setName('member').setDescription('Whose year (default: yours)').setRequired(false))
      .addIntegerOption((option) =>
        option.setName('year').setDescription('Which year (default: this year)').setRequired(false).setMinValue(2020)
      );
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    if (!interaction.inCachedGuild()) {
      await InterActionUtils.send(interaction, 'Use /wrapped in a server.', true);
      return;
    }
    const picked = interaction.options.getUser('member');
    // getMember is null for someone who left the server, so their old stats aren't posted
    const member = picked ? interaction.options.getMember('member') : interaction.member;
    if (!member || member.user.bot) {
      await InterActionUtils.send(interaction, 'Pick a member of this server (not a bot).', true);
      return;
    }
    const now = new Date();
    const year = interaction.options.getInteger('year') ?? now.getUTCFullYear();
    if (year > now.getUTCFullYear()) {
      await InterActionUtils.send(interaction, `${year} hasn't happened yet.`, true);
      return;
    }

    const guild = interaction.guild;
    // The card stays in UTC; bots in the gateway cache are left out of the buddies and the rank
    const wrapped = await getMemberWrapped(client.dataSource, guild.id, member.id, year, {
      now,
      botIds: discordDirectory().botIds(guild.id),
    });
    if (wrapped.voiceMs === 0 && wrapped.messages === 0) {
      await InterActionUtils.send(interaction, `Nothing to wrap: ${member.displayName} wasn't in voice or chat here in ${year}.`, true);
      return;
    }

    const buddyIds = wrapped.buddies.map((b) => b.memberId);
    const members = await cardMembers(guild, [member.id, ...buddyIds]);
    const svg = wrappedCard(
      {
        wrapped,
        member: members[member.id],
        serverName: guild.name,
        channelNames: wrapped.topChannels.map(({ channelId }) => {
          const channel = guild.channels.cache.get(channelId);
          // Public reply: never name a channel @everyone can't see
          return channel?.permissionsFor(guild.roles.everyone)?.has('ViewChannel') ? channel.name : undefined;
        }),
        buddies: buddyIds.map((id) => members[id]),
      },
      THEMES[DEFAULT_THEME]
    );
    const url = dashboardUrl(`/overview/detail/${guild.id}/members/${member.id}/wrapped?year=${year}`);
    await InterActionUtils.send(interaction, {
      files: [await cardFile(svg, `wrapped-${year}.png`)],
      components: url ? [dashboardButton(url, 'Open on the dashboard')] : [],
    });
  }
}
