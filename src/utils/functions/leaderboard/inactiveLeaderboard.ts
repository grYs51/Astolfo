import { voice_stats } from '@prisma/client';
import { VOICE_TYPE } from '../../handlers/vc';
import {
  getLeaderboardType,
  getVoiceStatsType,
  Leaderboard,
} from './leaderboard';

export const getInactiveVoiceStats: getVoiceStatsType = async (
  client,
  guildId,
  fromTime?
) => {
  const dbVoiceStats = await client.dataSource.voiceStats.findMany({
    where: {
      guild_id: guildId,
      type: {
        in: [
          VOICE_TYPE.DEAF,
          VOICE_TYPE.MUTED,
          VOICE_TYPE.SERVER_DEAF,
          VOICE_TYPE.SERVER_MUTED,
        ],
      },
      issued_on: fromTime ? { gte: fromTime.toISOString() } : undefined,
    },
  });

  const inChannel = client.voiceUsers
    .filter(
      (x) =>
        x.guild_id === guildId &&
        [
          VOICE_TYPE.DEAF,
          VOICE_TYPE.MUTED,
          VOICE_TYPE.SERVER_DEAF,
          VOICE_TYPE.SERVER_MUTED,
        ].includes(x.type as VOICE_TYPE)
    )
    .map((x) => ({ ...x, ended_on: new Date() })) as voice_stats[];

  return [...dbVoiceStats, ...inChannel];
};

export const getInactiveLeaderboard: getLeaderboardType = (members, stats) => {
  const leaderboard = stats.reduce((acc, stat) => {
    let activeTime = stat.ended_on.getTime() - stat.issued_on.getTime();

    const overlaps = stats.filter(
      (other) =>
        other.member_id !== stat.member_id &&
        other.channel_id === stat.channel_id &&
        !(
          other.ended_on.getTime() <= stat.issued_on.getTime() ||
          other.issued_on.getTime() >= stat.ended_on.getTime()
        )
    );

    const overlapTime = overlaps.reduce((acc, overlap) => {
      const overlapStart = Math.max(
        overlap.issued_on.getTime(),
        stat.issued_on.getTime()
      );
      const overlapEnd = Math.min(
        overlap.ended_on.getTime(),
        stat.ended_on.getTime()
      );

      return acc + (overlapEnd - overlapStart);
    }, 0);

    activeTime -= overlapTime;

    const memberStats = acc.find((x) => x.id === stat.member_id);
    if (memberStats) {
      memberStats.count += activeTime;
    } else {
      const name = members.find((m) => m.id === stat.member_id)!.user.username;
      acc.push({
        id: stat.member_id,
        count: activeTime,
        name,
      });
    }

    return acc;
  }, [] as Leaderboard[]);

  return leaderboard;
};
