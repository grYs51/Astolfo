import { currentRules } from '../xp/rules';

const HOUR = 60 * 60 * 1000;

/** Lifetime voice hours worth a mention: the XP rules' milestones, set on /admin */
const milestoneHours = () => currentRules().thresholds.milestoneHours;

/** The next milestone above `ms` with its grid; undefined once past the last one */
export const nextMilestone = (ms: number, hoursList = milestoneHours()) => {
  const hours = hoursList.find((h) => h * HOUR > ms);
  return hours === undefined ? undefined : { hours, remainingMs: hours * HOUR - ms, ...milestoneGrid(hours, ms / HOUR) };
};

/** Milestones (in hours) reached between `beforeMs` and `afterMs` */
export const crossedMilestones = (beforeMs: number, afterMs: number, hoursList = milestoneHours()) =>
  hoursList.filter((h) => beforeMs < h * HOUR && afterMs >= h * HOUR);

/** The lowest milestone, in ms; out of reach when there are none */
export const firstMilestoneMs = (hoursList = milestoneHours()) => (hoursList.length ? hoursList[0] * HOUR : Number.MAX_SAFE_INTEGER);

/** The milestone grid is at most 100 squares, 20 a row: a wide 20×5 band where one square is 1% */
export const MILESTONE_GRID_COLUMNS = 20;
const MAX_SQUARES = 100;

/**
 * The milestone grid the card and the dashboard draw: one square per hour up to
 * 100 h, past that 100 squares of `perSquare` hours each (fractional, e.g. 2.5 h at 250 h).
 */
export const milestoneGrid = (hours: number, hoursDone: number) => {
  const squares = Math.min(hours, MAX_SQUARES);
  const perSquare = hours / squares;
  const done = Math.floor(hoursDone / perSquare);
  return { squares, perSquare, done, partial: hoursDone / perSquare > done };
};
