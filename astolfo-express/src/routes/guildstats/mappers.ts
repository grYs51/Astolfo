import dayjs from 'dayjs';
import { DbGuildStats } from '../../db/models';
import { GuildStatsDTO } from './resources';


export const mapDbGuildStatsToGuildStatsDTO = ({ _id, ...stats }: DbGuildStats): GuildStatsDTO => ({
  ...stats,
  id: _id.toString(),
  issuedOn: dayjs(stats.issuedOn).toISOString(),
  endedOn: stats.endedOn ? dayjs(stats.endedOn).toISOString() : undefined,
});
