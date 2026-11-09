import { Events, GuildMember, PartialGuildMember } from 'discord.js';
import BaseEvent from '../../utils/structures/base-event';
import DiscordClient from '../../client/client';
import { goodbyePost } from '../../utils/functions/member-messages';

/**
 * Goodbye post in the welcome channel. The client has no Partials, so
 * discord.js skips this for members it never cached (offline members of
 * large servers).
 */
export default class GuildMemberRemoveEvent extends BaseEvent {
  constructor() {
    super(Events.GuildMemberRemove);
  }

  async event(client: DiscordClient, member: GuildMember | PartialGuildMember) {
    const config = client.guildConfigs.get(member.guild.id);
    // Username, not display name: nicknames are free text (links, slurs), usernames only a-z 0-9 _ .
    const post = config && goodbyePost(config.goodbye_message, member.user.username);
    const channel = config?.welcome_channel_id
      ? member.guild.channels.cache.get(config.welcome_channel_id)
      : undefined;

    if (!post || !channel?.isSendable()) {
      return;
    }

    await channel.send(post);
  }
}
