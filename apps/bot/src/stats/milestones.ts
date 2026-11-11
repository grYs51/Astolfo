import { currentRules } from '../xp/rules';

const HOUR = 60 * 60 * 1000;

/** Lifetime voice hours worth a mention: the XP rules' milestones, set on /admin */
const milestoneHours = () => currentRules().thresholds.milestoneHours;

/** The next milestone above `ms`; undefined once past the last one */
export const nextMilestone = (ms: number, hoursList = milestoneHours()) => {
  const hours = hoursList.find((h) => h * HOUR > ms);
  return hours === undefined ? undefined : { hours, remainingMs: hours * HOUR - ms };
};

/** Milestones (in hours) reached between `beforeMs` and `afterMs` */
export const crossedMilestones = (beforeMs: number, afterMs: number, hoursList = milestoneHours()) =>
  hoursList.filter((h) => beforeMs < h * HOUR && afterMs >= h * HOUR);

/** The lowest milestone, in ms; out of reach when there are none */
export const firstMilestoneMs = (hoursList = milestoneHours()) => (hoursList.length ? hoursList[0] * HOUR : Number.MAX_SAFE_INTEGER);

/**
 * The milestone grid: one square per hour, or per few hours past 1000 so the
 * grid stays at most 1000 squares (the admin can set up to 10 000 hours).
 * Shared shape with the dashboard's `member-activity` milestone; change both together.
 */
export const milestoneGrid = (hours: number, hoursDone: number) => {
  const perSquare = Math.ceil(hours / 1000);
  const squares = Math.ceil(hours / perSquare);
  const done = Math.floor(hoursDone / perSquare);
  return {
    squares,
    done,
    partial: hoursDone / perSquare > done,
    columns: squares <= 50 ? 10 : squares <= 250 ? 25 : 50,
  };
};
