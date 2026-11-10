const HOUR = 60 * 60 * 1000;

/** Lifetime voice hours worth a mention. shortcut: hard-coded, make per-guild with role rewards (3.2) */
export const MILESTONE_HOURS = [10, 50, 100, 250, 500, 1000];

/** The next milestone above `ms`; undefined once past the last one */
export const nextMilestone = (ms: number) => {
  const hours = MILESTONE_HOURS.find((h) => h * HOUR > ms);
  return hours === undefined ? undefined : { hours, remainingMs: hours * HOUR - ms };
};

/** Milestones (in hours) reached between `beforeMs` and `afterMs` */
export const crossedMilestones = (beforeMs: number, afterMs: number) =>
  MILESTONE_HOURS.filter((h) => beforeMs < h * HOUR && afterMs >= h * HOUR);
