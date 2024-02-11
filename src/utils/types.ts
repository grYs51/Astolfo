import { Channel, Guild, GuildMember } from 'discord.js';

export interface Info {
  guild: Guild;
  member: GuildMember;
  channel: Channel;
}
