import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'guild_configurations' })
export class GuildConfiguration {
  @PrimaryColumn({ unique: true, name: 'guild_id' })
    guildId!: string;

  @Column({ default: '!' })
    prefix?: string;

  @Column({ name: 'welcome_channel_id', nullable: true })
    welcomeChannelId?: string;

  @Column({ name: 'welcome_message', length: 200, default: 'Welcome @member' })
    welcomeMessage?: string;

  @Column({ name: 'goodbye_message', length: 200, default: 'Goodbye @member' })
    goodbyeMessage?: string;
}
