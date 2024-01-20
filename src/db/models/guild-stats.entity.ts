import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

@Entity({ name: 'guild_stats' })
export class GuildStats {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ name: 'guild_id' })
  guildId: string;

  @Column({ name: 'member_id' })
  memberId: string;

  @Column({ name: 'issued_by_id', nullable: true })
  issuedById?: string;

  @Column({ name: 'channel_id' })
  channelId: string;

  // @Column({ name: 'new_channel', nullable: true })
  @Column({ name: 'new_channel_id', nullable: true })
  newChannelId?: string;

  @Column()
  type: VoiceType;

  @Column({ name: 'issued_on' })
  issuedOn!: Date;

  @Column({ name: 'ended_on', nullable: true })
  endedOn?: Date;
}
