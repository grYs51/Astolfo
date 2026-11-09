import { Events, GuildMember, PartialGuildMember, TextChannel } from 'discord.js';
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
    const post = config && goodbyePost(config.goodbye_message, member.displayName);
    const channel =
      config?.welcome_channel_id &&
      (member.guild.channels.cache.get(config.welcome_channel_id) as TextChannel | undefined);

    if (!post || !channel) {
      return;
    }

    await channel.send(post);
  }
}
