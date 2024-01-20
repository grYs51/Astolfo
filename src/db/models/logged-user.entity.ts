import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'logged_users' })
export class LoggedUser {
  @PrimaryColumn({ name: 'discord_id', unique: true })
  id: string;

  @Column({ name: 'access_token' })
  accessToken: string;

  @Column({ name: 'refresh_token' })
  refreshToken: string;
}
