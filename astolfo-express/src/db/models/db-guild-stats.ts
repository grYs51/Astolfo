import { ObjectId } from 'mongodb';


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

export interface DbGuildStats {
  _id: ObjectId;
  guildId: string;
  memberId: string;
  issuedById: string;
  channelId: string;
  newChannelId?: string;
  type: VoiceType;
  issuedOn: Date;
  endedOn?: Date;
}
