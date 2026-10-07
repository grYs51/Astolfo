import { voice_stats } from '@prisma/client';
import DiscordClient from '../../../client/client';
import { VOICE_TYPE } from '../../handlers/vc';

export type Interval = { start: number; end: number };

/**
 * Total length covered by the intervals, counting overlapping parts once
 * (e.g. deafening also mutes, so DEAF and MUTED overlap exactly).
 */
export const unionDuration = (intervals: Interval[]): number => {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let current: Interval | null = null;

  for (const interval of sorted) {
    if (current && interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end);
    } else {
      if (current) total += current.end - current.start;
      current = { ...interval };
    }
  }
  if (current) total += current.end - current.start;

  return total;
};

/**
 * Open sessions of a guild from the in-memory cache, as rows closed at "now".
 * Rows that started before `fromTime` are clipped to it, so a session that
 * has been open for days only counts the part inside the selected range.
 */
export const getOpenVoiceStats = (
  client: DiscordClient,
  guildId: string,
  types: VOICE_TYPE[],
  fromTime?: Date
): voice_stats[] => {
  const now = new Date();
  return Array.from(client.voiceUsers.entries())
    .filter(([key]) => key.startsWith(`${guildId}:`))
    .flatMap(([, stats]) => stats)
    .filter((stat) => types.includes(stat.type as VOICE_TYPE))
    .map((stat) => ({
      ...stat,
      issued_on:
        fromTime && stat.issued_on < fromTime ? fromTime : stat.issued_on,
      ended_on: now,
    }));
};
