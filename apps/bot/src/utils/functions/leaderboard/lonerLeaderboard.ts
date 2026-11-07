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

/**
 * Time each member spent alone in a channel. Per channel, session starts and
 * ends are walked once in time order (O(n log n)); while exactly one member
 * is present, the time is theirs. The old pairwise version compared every
 * session with every other one and froze the process on large histories.
 */
export const getLonerLeaderboard = (
  members: SimpleGuildMember[],
  stats: voice_stats[]
): Leaderboard[] => {
  const eventsByChannel = new Map<string, { time: number; memberId: string; delta: 1 | -1 }[]>();
  for (const stat of stats) {
    const events = eventsByChannel.get(stat.channel_id) ?? [];
    events.push(
      { time: stat.issued_on.getTime(), memberId: stat.member_id, delta: 1 },
      { time: stat.ended_on.getTime(), memberId: stat.member_id, delta: -1 }
    );
    eventsByChannel.set(stat.channel_id, events);
  }

  const aloneMs = new Map<string, number>();
  for (const events of eventsByChannel.values()) {
    // Ends before starts at the same instant: back-to-back sessions don't overlap
    events.sort((a, b) => a.time - b.time || a.delta - b.delta);
    // Open sessions per member in the channel (members not in the guild
    // still keep others company)
    const present = new Map<string, number>();
    let since = 0;
    for (const { time, memberId, delta } of events) {
      if (present.size === 1) {
        const [only] = present.keys();
        aloneMs.set(only, (aloneMs.get(only) ?? 0) + time - since);
      }
      since = time;
      const open = (present.get(memberId) ?? 0) + delta;
      if (open > 0) present.set(memberId, open);
      else present.delete(memberId);
    }
  }

  const membersById = new Map(members.map((member) => [member.id, member]));
  return [...aloneMs].flatMap(([id, count]) => {
    const member = membersById.get(id);
    // Members no longer in the guild (or not cached) are skipped
    return member && count > 0
      ? [{ id, name: member.displayName ?? member.user.username, count }]
      : [];
  });
};
