import { Events, GuildMember, TextChannel } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super(Events.GuildMemberAdd);
  }

  async event(client: DiscordClient, member: GuildMember) {
    const config = client.guildConfigs.get(member.guild.id);
    const channelId = config?.welcome_channel_id;
    
    if (!channelId) {
      return 
    }
  
    const channel = member.guild.channels.cache.get(channelId) as TextChannel;
    
    if (!channel) {
      return client.logger.info('No welcome channel found');
    }
  
    channel.send(`Welcome ${member}`);
  }
}
