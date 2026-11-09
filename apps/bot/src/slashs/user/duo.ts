import { CacheType, ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';
import { isHiddenFrom } from '../../utils/privacy';
import { getDuo } from '../../stats/queries';
import { PERIOD_CHOICES } from '../../stats/messages';
import { StatsPeriod } from '../../stats/windows';
import { cardMembers } from '../../cards/members';
import { cardFile } from '../../cards/render';
import { duoCard } from '../../cards/duo.card';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

/**
 * /duo member [period] — how much time you spent in voice with one member.
 * Public, like the digest's duo of the week; refusals only you see.
 */
export default class DuoSlash extends BaseSlash {
  constructor() {
    super('duo', 'Time you spent in voice with another member', SlashDeferTypes.PUBLIC);
  }

  override createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addUserOption((option) => option.setName('member').setDescription('Who to compare with').setRequired(true))
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
    if (!interaction.inCachedGuild()) {
      await InterActionUtils.send(interaction, 'Use /duo in a server.', true);
      return;
    }
    const me = interaction.user.id;
    const other = interaction.options.getUser('member', true);
    if (other.id === me || other.bot) {
      await InterActionUtils.send(interaction, 'Pick another member (not yourself or a bot).', true);
      return;
    }
    // The reply is public, so a hidden member's time is never posted
    if (await isHiddenFrom(client.dataSource, other.id, me)) {
      await InterActionUtils.send(interaction, 'This member keeps their stats private.', true);
      return;
    }

    const period = (interaction.options.get('period')?.value as StatsPeriod | undefined) ?? 'month';
    const guild = interaction.guild;
    const duo = await getDuo(client.dataSource, guild.id, me, other.id, period);
    const members = await cardMembers(guild, [me, other.id]);
    const svg = duoCard(
      {
        duo,
        period,
        members: [members[me], members[other.id]],
        serverName: guild.name,
        topChannelName: duo.topChannelId ? guild.channels.cache.get(duo.topChannelId)?.name : undefined,
      },
      THEMES[DEFAULT_THEME]
    );
    await InterActionUtils.send(interaction, { files: [await cardFile(svg, 'duo.png')] });
  }
}
