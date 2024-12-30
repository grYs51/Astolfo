import { voice_stats } from '@prisma/client';
import {
  Leaderboard,
  getLeaderboardType,
  getVoiceStatsType,
} from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';

export const getCurrentVoiceStats: getVoiceStatsType = (client, guildId) => {
  const stats = client.voiceUsers
    .filter((x) => x.guild_id === guildId && x.type === VOICE_TYPE.VOICE)
    .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

  return Promise.resolve(stats);
};

export const getCurrentLeaderboard: getLeaderboardType = (members, stats) => {
  const leaderboard = stats.reduce((acc, stat) => {

    const activeTime = stat.ended_on.getTime() - stat.issued_on.getTime();

    const memberStat = acc.find((x) => x.id === stat.member_id);

    if (memberStat) {
      memberStat.count += activeTime;
    } else {
      const member = members.find((m) => m.id === stat.member_id);
      if (member) {
        acc.push({
          id: stat.member_id,
          count: activeTime,
          name: member.displayName ?? member.user.username,
        });
      }
    }

    return acc;
  }, [] as Leaderboard[]);

  return leaderboard;
};
