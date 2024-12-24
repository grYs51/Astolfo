import {
  Leaderboard,
  getVoiceStatsType,
  getLeaderboardType,
} from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';
import { getCurrentVoiceStats } from './currentLeaderboard';

const voiceTypesToCheck = [
  VOICE_TYPE.VOICE,
  VOICE_TYPE.MUTED,
  VOICE_TYPE.DEAF,
  VOICE_TYPE.SERVER_DEAF,
  VOICE_TYPE.SERVER_MUTED,
];

export const getActiveVoiceStats: getVoiceStatsType = async (
  client,
  guildId,
  fromTime?
) => {
  const dbVoiceStatsOfGuild = await client.dataSource.voiceStats.findMany({
    where: {
      guild_id: guildId,
      type: {
        in: voiceTypesToCheck,
      },
      issued_on: fromTime ? { gte: fromTime.toISOString() } : undefined,
    },
  });

  const inChannel = await getCurrentVoiceStats(client, guildId);

  return [...dbVoiceStatsOfGuild, ...inChannel];
};

export const getActiveLeaderboard: getLeaderboardType = (members, stats) => {
  const leaderboard = stats.reduce((acc, stat) => {
    if (stat.type !== VOICE_TYPE.VOICE) return acc;

    let activeTime = stat.ended_on.getTime() - stat.issued_on.getTime();
    const deductedTypes = [
      VOICE_TYPE.MUTED,
      VOICE_TYPE.DEAF,
      VOICE_TYPE.SERVER_DEAF,
      VOICE_TYPE.SERVER_MUTED,
    ];
    const mutedOrDeafenedStats = stats.filter(
      (s) =>
        s.member_id === stat.member_id &&
        deductedTypes.includes(s.type as VOICE_TYPE) &&
        s.issued_on <= stat.ended_on &&
        s.ended_on >= stat.issued_on
    );

    mutedOrDeafenedStats.forEach((s) => {
      const overlapStart = Math.max(
        s.issued_on.getTime(),
        stat.issued_on.getTime()
      );
      const overlapEnd = Math.min(
        s.ended_on.getTime(),
        stat.ended_on.getTime()
      );
      activeTime -= Math.max(0, overlapEnd - overlapStart);
    });

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
