import { voice_stats } from '@prisma/client';
import {
  SimpleGuildMember,
  Leaderboard,
  getVoiceStatsType,
} from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';
import { getOpenVoiceStats } from './intervals';

export const getLonerVoiceStats: getVoiceStatsType = async (
  client,
  guildId,
  fromTime?
) => {
  const dbVoiceStats = await client.dataSource.voiceStats.findMany({
    where: {
      guild_id: guildId,
      type: VOICE_TYPE.VOICE,
      issued_on: fromTime ? { gte: fromTime.toISOString() } : undefined,
      // Open rows are merged from the in-memory cache below — including them
      // here would double-count live sessions
      ended_on: { not: null },
    },
  });

  const inChannel = getOpenVoiceStats(client, guildId, [VOICE_TYPE.VOICE], fromTime);

  return [...dbVoiceStats, ...inChannel];
};

export const getLonerLeaderboard = (
  members: SimpleGuildMember[],
  stats: voice_stats[]
): Leaderboard[] => {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const exclusiveTimes = new Map<string, Leaderboard>();

  for (const stat of stats) {
    const { member_id, channel_id, issued_on, ended_on } = stat;

    // Members no longer in the guild (or not cached) are skipped rather than
    // crashing the whole leaderboard
    const member = membersById.get(member_id);
    if (!member) continue;
    // Find all overlapping intervals in the same channel
    const overlaps = stats.filter(
      (other) =>
        other.member_id !== member_id && // Different member
        other.channel_id === channel_id && // Same channel
        !(
          other.ended_on.getTime() <= issued_on.getTime() ||
          other.issued_on.getTime() >= ended_on.getTime()
        ) // Overlapping interval
    );

    // Break down the interval into sub-intervals

    let aloneTime = 0;
    let currentStart = issued_on.getTime();

    // Sort overlaps by start time
    const sortedOverlaps = overlaps
      .map((o) => ({ start: o.issued_on, end: o.ended_on }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const overlap of sortedOverlaps) {
      if (overlap.start.getTime() > currentStart) {
        // Member is alone between currentStart and overlap.start
        aloneTime +=
          Math.min(ended_on?.getTime() || 0, overlap.start.getTime()) -
          currentStart;
      }
      // Update currentStart to the end of the overlap if it extends further
      currentStart = Math.max(
        currentStart,
        overlap.end?.getTime() || currentStart
      );
    }

    // Add any remaining alone time after the last overlap
    if (currentStart < ended_on.getTime()) {
      aloneTime += ended_on.getTime() - currentStart;
    }

    // Add the time to the member's total
    const total = exclusiveTimes.get(member_id);
    if (total) {
      total.count += aloneTime;
    } else {
      exclusiveTimes.set(member_id, {
        id: member_id,
        name: member.displayName ?? member.user.username,
        count: aloneTime,
      });
    }
  }

  return Array.from(exclusiveTimes.values()).filter(({ count }) => count);
};
