import { voice_stats } from '@prisma/client';
import {
  Leaderboard,
  getVoiceStatsType,
  getLeaderboardType,
} from './leaderboard';

export const getActiveVoiceStats: getVoiceStatsType = async (
  client,
  guildId,
  fromTime?
) => {
  const dbVoiceStatsOfGuild = await client.dataSource.voiceStats.findMany({
    where: {
      guild_id: guildId,
      type: 'VOICE',
      issued_on: fromTime ? { gte: fromTime.toISOString() } : undefined,
    },
  });
  const inChannel = client.voiceUsers
    .filter((x) => x.guild_id === guildId && x.type === 'VOICE') // TODO: Add type to voice_stats
    .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

  return [...dbVoiceStatsOfGuild, ...inChannel];
};
export const getActiveLeaderboard: getLeaderboardType = (members, stats) =>
  stats.reduce((acc, stat) => {
    const a = acc.find((x) => x.id === stat.member_id);

    if (a) {
      a.count += stat.ended_on!.getTime() - stat.issued_on.getTime();
    } else {
      const member = members.find((m) => m.id === stat.member_id);
      if (member) {
        acc.push({
          id: stat.member_id,
          count: stat.ended_on!.getTime() - stat.issued_on.getTime(),
          name: member?.user.username || 'Unknown',
        });
      }
    }
    return acc;
  }, [] as Leaderboard[]);
