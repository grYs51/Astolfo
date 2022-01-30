import { GuildConfiguration } from 'src/utils/typeorm/entities/GuildConfiguration';
import { GuildStatsLog } from 'src/utils/typeorm/entities/GuildStatsLog';
import { ModerationLog } from 'src/utils/typeorm/entities/ModerationLog';

export interface IGuildService {
  getGuildConfig(guildId: string): Promise<GuildConfiguration>;
  updateGuildPrefix(
    guildId: string,
    prefix: string,
  ): Promise<GuildConfiguration>;
  updateWelcomeChannel(guildId: string, welcomeChannelId: string);
  getGuildLogs(guildId: string, fromDate?: Date): Promise<ModerationLog[]>;

  getGuildStats(guildId: string, fromDate?: Date): Promise<GuildStatsLog[]>;
}
