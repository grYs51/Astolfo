import { CommandInteraction, CacheType } from 'discord.js';
import BaseSlash from '../../utils/structures/base-slash';
import client from '../../client/client';
export default class UpTimeEvent extends BaseSlash {
  constructor() {
    super('uptime', 'Shows the uptime of the bot');
  }

  async slash(
    client: client,
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const uptime = client.uptime || 0;
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const minutes = Math.floor(uptime / 60000) % 60;
    const seconds = Math.floor(uptime / 1000) % 60;
    await interaction.reply(
      `Uptime: \`${days}d ${hours}h ${minutes}m ${seconds}s\``
    );
  }
}
