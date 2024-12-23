import { voice_stats } from "@prisma/client";
import { SimpleGuildMember, Leaderboard } from "./leaderboard";

export const getLonerBoard = (
  members: SimpleGuildMember[],
  stats: voice_stats[]
): Leaderboard[] => {
  // Store results
  const exclusiveTimes: Record<string, number> = {};
  for (const stat of stats) {
    const { member_id, channel_id, issued_on, ended_on } = stat;

    const name = members.find((m) => m.id === member_id)!.user.username;

    if (!name) continue;
    // Find all overlapping intervals in the same channel
    const overlaps = stats.filter(
      (other) =>
        other.member_id !== member_id && // Different member
        other.channel_id === channel_id && // Same channel
        !(
          other.ended_on!.getTime()! <= issued_on.getTime() ||
          other.issued_on.getTime() >= ended_on!.getTime()
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
    if (currentStart < ended_on!.getTime()) {
      aloneTime += ended_on!.getTime() - currentStart;
    }

    // Add the time to the member's total
    if (!exclusiveTimes[`${name}:${member_id}`]) {
      exclusiveTimes[`${name}:${member_id}`] = 0;
    }
    exclusiveTimes[`${name}:${member_id}`] += aloneTime;
  }

  // Format results
  return Object.entries(exclusiveTimes)
    .filter(([, count]) => count)
    .map(([key, count]) => {
      const [name, id] = key.split(':');
      return {
        name,
        id,
        count,
      };
    });
};