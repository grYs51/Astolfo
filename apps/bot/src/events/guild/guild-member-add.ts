import { Events, GuildMember } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { Logger } from '../../utils/logger';
import { welcomePost } from '../../utils/functions/member-messages';

export default class GuildMemberAddEvent extends BaseEvent {
  constructor() {
    super(Events.GuildMemberAdd);
  }

  async event(client: DiscordClient, member: GuildMember) {
    const config = client.guildConfigs.get(member.guild.id);
    const channelId = config?.welcome_channel_id;

    if (!channelId) {
      return;
    }

    const channel = member.guild.channels.cache.get(channelId);

    // ,setwelcomechannel accepts any channel, a category included
    if (!channel?.isSendable()) {
      return Logger.info('No welcome channel found');
    }

    await channel.send(welcomePost(config.welcome_message, member.id));
  }
}
