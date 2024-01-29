import { CommandInteraction, CacheType } from 'discord.js';
import DiscordClient from '../../client/client';
import BaseSlash from '../../utils/structures/BaseSlash';
import { login } from 'call-of-duty-api';

export default class MWLogin extends BaseSlash {
  async run(
    client: DiscordClient,
    interaction: CommandInteraction<CacheType>,
  ): Promise<void> {
    if (process.env.OWNER != interaction.user.id) {
      interaction.reply('You are not the owner of this bot!');
      return Promise.resolve();
    }

    const bool = login(process.env.COD_SSO!);

    if (bool) {
      interaction.reply('Logged in!');
      return Promise.resolve();
    } else {
      interaction.reply('Failed to login!');
      return Promise.resolve();
    }
  }

  constructor() {
    super('mwlogin', 'Login to your account');
  }
}
