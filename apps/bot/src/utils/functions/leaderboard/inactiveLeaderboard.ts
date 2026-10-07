import { VOICE_TYPE } from '../../handlers/vc';
import {
  getLeaderboardType,
  getVoiceStatsType,
  Leaderboard,
} from './leaderboard';
import { getOpenVoiceStats, Interval, unionDuration } from './intervals';

const inactiveTypes = [
  VOICE_TYPE.DEAF,
  VOICE_TYPE.MUTED,
  VOICE_TYPE.SERVER_DEAF,
  VOICE_TYPE.SERVER_MUTED,
];

export const getInactiveVoiceStats: getVoiceStatsType = async (
  client,
  guildId,
  fromTime?
) => {
  const dbVoiceStats = await client.dataSource.voiceStats.findMany({
    where: {
      guild_id: guildId,
      type: {
        in: inactiveTypes,
      },
      issued_on: fromTime ? { gte: fromTime.toISOString() } : undefined,
      // Open rows are merged from the in-memory cache below — including them
      // here would double-count live sessions
      ended_on: { not: null },
    },
  });

  const inChannel = getOpenVoiceStats(client, guildId, inactiveTypes, fromTime);

  return [...dbVoiceStats, ...inChannel];
};

/**
 * Time each member spent muted or deafened. A member's own intervals are
 * merged first: deafening also mutes, so DEAF and MUTED rows overlap and
 * summing them would double the time.
 */
export const getInactiveLeaderboard: getLeaderboardType = (members, stats) => {
  const intervalsByMember = new Map<string, Interval[]>();
  for (const stat of stats) {
    const list = intervalsByMember.get(stat.member_id) ?? [];
    list.push({ start: stat.issued_on.getTime(), end: stat.ended_on.getTime() });
    intervalsByMember.set(stat.member_id, list);
  }

  const membersById = new Map(members.map((member) => [member.id, member]));
  const leaderboard: Leaderboard[] = [];

  for (const [memberId, intervals] of intervalsByMember) {
    // Members no longer in the guild (or not cached) are skipped
    const member = membersById.get(memberId);
    if (!member) continue;

    leaderboard.push({
      id: memberId,
      count: unionDuration(intervals),
      name: member.displayName ?? member.user.username,
    });
  }

  return leaderboard;
};
