import { voice_stats } from '@prisma/client';
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

const deductedTypes = [
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

/**
 * Sums the merged (deduplicated) overlap of muted/deaf intervals with a
 * voice span. Merging first prevents double-deducting when a user is
 * simultaneously MUTED and DEAF (deafening also mutes).
 */
const deductedOverlap = (
  voiceStart: number,
  voiceEnd: number,
  deductedStats: voice_stats[]
): number => {
  const intervals = deductedStats
    .map((s) => ({
      start: Math.max(s.issued_on.getTime(), voiceStart),
      end: Math.min(s.ended_on.getTime(), voiceEnd),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let currentStart: number | null = null;
  let currentEnd = 0;

  for (const interval of intervals) {
    if (currentStart === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }
  if (currentStart !== null) {
    total += currentEnd - currentStart;
  }

  return total;
};

export const getActiveLeaderboard: getLeaderboardType = (members, stats) => {
  // Pre-group deducted stats by member so each VOICE stat doesn't re-scan
  // the whole array (previously O(n²))
  const deductedByMember = new Map<string, voice_stats[]>();
  for (const stat of stats) {
    if (!deductedTypes.includes(stat.type as VOICE_TYPE)) continue;
    const list = deductedByMember.get(stat.member_id);
    if (list) {
      list.push(stat);
    } else {
      deductedByMember.set(stat.member_id, [stat]);
    }
  }

  const membersById = new Map(members.map((member) => [member.id, member]));
  const leaderboard = new Map<string, Leaderboard>();

  for (const stat of stats) {
    if (stat.type !== VOICE_TYPE.VOICE) continue;

    const start = stat.issued_on.getTime();
    const end = stat.ended_on.getTime();
    const activeTime =
      end -
      start -
      deductedOverlap(start, end, deductedByMember.get(stat.member_id) ?? []);

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
