import { CacheType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { isHiddenFrom } from '../../utils/privacy';
import { getMemberProfile } from '../../stats/queries';
import { CARD_IMAGE, fetchImage } from '../../cards/avatars';
import { profileCard } from '../../cards/profile.card';
import { cardFile } from '../../cards/render';
import { DEFAULT_THEME, THEMES } from '../../cards/themes';

export default class ProfileSlash extends BaseSlash {
  constructor() {
    super('profile', 'Show my profile', SlashDeferTypes.PUBLIC);
  }

  createInteraction() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addMentionableOption((option) =>
        option
          .setName('user')
          .setDescription("Get other user's profile (optional)")
          .setRequired(false)
      );
  }

  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    // Members and channels come from the server's cache; in a DM there is none
    if (!interaction.inCachedGuild()) {
      await InterActionUtils.send(interaction, 'Use /profile in a server.', true);
      return;
    }
    const guildId = interaction.guildId;
    const memberToGetProfileFor = interaction.options.get('user')?.member || interaction.member;
    const userId = memberToGetProfileFor.id;

    // Members can hide from other members (dashboard privacy setting); this
    // reply is public, so don't post their stats — tell only the asker
    if (await isHiddenFrom(client.dataSource, userId, interaction.user.id)) {
      await InterActionUtils.send(
        interaction,
        'This member keeps their stats private.',
        true
      );
      return;
    }

    const now = new Date();
    const profile = await getMemberProfile(client.dataSource, guildId, userId, now);

    if (profile.sessions === 0) {
      await InterActionUtils.send(
        interaction,
        "Couldn't find voice session for this user, encourage the user to join the voice channels UwU",
        true
      );
      return;
    }

    const svg = profileCard(
      {
        profile,
        memberName: memberToGetProfileFor.displayName,
        avatar: await fetchImage(memberToGetProfileFor.displayAvatarURL(CARD_IMAGE)),
        serverName: interaction.guild.name,
        favouriteChannelName: profile.favouriteChannelId
          ? interaction.guild.channels.cache.get(profile.favouriteChannelId)?.name
          : undefined,
        now,
      },
      THEMES[DEFAULT_THEME]
    );
    await InterActionUtils.send(interaction, { files: [await cardFile(svg, 'profile.png')] });
  }
}
