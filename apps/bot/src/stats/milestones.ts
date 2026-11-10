const HOUR = 60 * 60 * 1000;

/** Lifetime voice hours worth a mention. shortcut: hard-coded, make per-guild with role rewards (3.2) */
export const MILESTONE_HOURS = [10, 50, 100, 250, 500, 1000];

/**
 * The next milestone above `ms`, with `progress` (0–1) from the milestone already passed (0h before the
 * first), so the bar starts empty after each one; undefined once past the last one
 */
export const nextMilestone = (ms: number) => {
  const i = MILESTONE_HOURS.findIndex((h) => h * HOUR > ms);
  if (i < 0) return undefined;
  const hours = MILESTONE_HOURS[i];
  const from = (MILESTONE_HOURS[i - 1] ?? 0) * HOUR;
  return { hours, remainingMs: hours * HOUR - ms, progress: (ms - from) / (hours * HOUR - from) };
};

/** Milestones (in hours) reached between `beforeMs` and `afterMs` */
export const crossedMilestones = (beforeMs: number, afterMs: number) =>
  MILESTONE_HOURS.filter((h) => beforeMs < h * HOUR && afterMs >= h * HOUR);
