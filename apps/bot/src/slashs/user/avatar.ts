import { CacheType, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import DiscordClient from '../../client/client';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';

export default class AvatarSlash extends BaseSlash {
  constructor() {
    super('avatar', 'Shows the avatar of the user', SlashDeferTypes.PUBLIC);
  }
  async slash(client: DiscordClient, interaction: ChatInputCommandInteraction<CacheType>) {
    const user = interaction.options.getUser('user') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setImage(user.displayAvatarURL({ size: 4096 }))
      .setFooter({
        text: `${user.tag}'s Avatar`,
      });

    await InterActionUtils.send(interaction, embed);
  }
}
