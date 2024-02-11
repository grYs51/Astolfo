import { Events, GuildMember, TextChannel } from 'discord.js';
import BaseEvent from '../../utils/structures/BaseEvent';
import DiscordClient from '../../client/client';

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super(Events.GuildMemberAdd);
  }

  async run(client: DiscordClient, member: GuildMember) {
    const config = client.guildConfigs.get(member.guild.id);
    if (config) {
      if (config.welcome_channel_id) {
        const channel = member.guild.channels.cache.get(
          config.welcome_channel_id,
        ) as TextChannel;
        if (!channel) {
          client.logger.info('No welcome channel found');
        } else {
          channel.send(`Welcome ${member}`);
        }
      } else {
        client.logger.info('No welcome channel set.');
      }
    }
  }
}
