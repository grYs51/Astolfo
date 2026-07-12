import { voice_stats } from '@prisma/client';
import {
  Leaderboard,
  getLeaderboardType,
  getVoiceStatsType,
} from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';

export const getCurrentVoiceStats: getVoiceStatsType = (client, guildId) => {
  const stats = Array.from(client.voiceUsers.entries())
    .filter(([key]) => key.startsWith(`${guildId}:`))
    .flatMap(([, s]) => s)
    .filter((x) => x.type === VOICE_TYPE.VOICE)
    .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

  return Promise.resolve(stats);
};

export const getCurrentLeaderboard: getLeaderboardType = (members, stats) => {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const leaderboard = new Map<string, Leaderboard>();

  for (const stat of stats) {
    const activeTime = stat.ended_on.getTime() - stat.issued_on.getTime();

    const memberStat = leaderboard.get(stat.member_id);
    if (memberStat) {
      memberStat.count += activeTime;
    } else {
      const member = membersById.get(stat.member_id);
      if (member) {
        leaderboard.set(stat.member_id, {
          id: stat.member_id,
          count: activeTime,
          name: member.displayName ?? member.user.username,
        });
      }
    }
  }

  return Array.from(leaderboard.values());
};
