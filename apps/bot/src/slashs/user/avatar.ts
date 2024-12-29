import { EmbedBuilder } from 'discord.js';
import { InterActionUtils } from '../../utils/interaction-utils';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';

export default class AvatarSlash extends BaseSlash {
  constructor() {
    super('avatar', 'Shows the avatar of the user', SlashDeferTypes.PUBLIC);
  }
  async slash(client, interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
      .setFooter({
        text: `${user.tag}'s Avatar`,
      });

    await InterActionUtils.send(interaction, embed);
  }
}
