import { Channel, Guild, GuildMember } from 'discord.js';
import { GuildStats } from '../../db/models';
import { VoiceType } from '../types';

export default class GuildStatDto implements GuildStats {
  constructor(
    guild: Guild,
    member: GuildMember,
    issuedBy: string,
    type: VoiceType,
    channel: Channel,
    date: Date,
    endedOn?: Date,
    newChannel?: Channel,
  ) {
    this.guildId = guild.id;
    this.memberId = member.id;
    this.issuedById = issuedBy;
    this.channelId = channel.id;
    this.newChannelId = newChannel?.id;
    this.type = type;
    this.issuedOn = date;
    this.endedOn = endedOn;
  }
  guildId: string;
  memberId: string;
  issuedById?: string | undefined;
  channelId: string;
  newChannelId?: string | undefined;
  type: VoiceType;
  issuedOn: Date;
  endedOn?: Date | undefined;
}
