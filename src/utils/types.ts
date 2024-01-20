import { Channel, Guild, GuildMember } from 'discord.js';

export type ModerationActionType = 'ban' | 'kick' | 'timeout';

export type VoiceType =
  | 'VOICE'
  | 'MUTE'
  | 'DEAF'
  | 'VIDEO'
  | 'MEMBER_UPDATE'
  | 'STREAMING'
  | 'MEMBER_DISCONNECT'
  | 'MEMBER_UPDATE_DEAF'
  | 'MEMBER_UPDATE_MUTE'
  | 'MEMBER_MOVE';

export interface Info {
  guild: Guild;
  member: GuildMember;
  channel: Channel;
}
