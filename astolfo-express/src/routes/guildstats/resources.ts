import { VoiceType } from '../../db/models';

export interface GuildStatsDTO {
  id: string;
  guildId: string;
  memberId: string;
  issuedById: string;
  channelId: string;
  newChannelId?: string;
  type: VoiceType;
  issuedOn: string;
  endedOn?: string;
}
