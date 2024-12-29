import { ChatInputCommandInteraction } from 'discord.js';
import client from '../../client/client';
import { BaseSlash, SlashDeferTypes } from '../../utils/structures/base-slash';
import { InterActionUtils } from '../../utils/interaction-utils';

export default class PingEvent extends BaseSlash {
  constructor() {
    super('ping', 'Shows the ping of the bot', SlashDeferTypes.HIDDEN);
  }

  async slash(
    client: client,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const ping = Date.now() - interaction.createdTimestamp;
    await InterActionUtils.send(interaction, `Pong! \`${ping}ms\``);
  }
}
