import { DEFAULT_RULES, setRules } from '../xp/rules';
import { crossedMilestones, milestoneGrid, nextMilestone } from './milestones';

const H = 60 * 60 * 1000;

describe('nextMilestone', () => {
  test('the first threshold above the total, with what is left', () => {
    expect(nextMilestone(0)).toEqual({ hours: 10, remainingMs: 10 * H });
    expect(nextMilestone(88 * H)).toEqual({ hours: 100, remainingMs: 12 * H });
  });
  test('exactly on a threshold points at the next one', () => {
    expect(nextMilestone(50 * H)).toEqual({ hours: 100, remainingMs: 50 * H });
  });
  test('nothing after the last one', () => {
    expect(nextMilestone(1000 * H)).toBeUndefined();
  });
});

describe('crossedMilestones', () => {
  test('thresholds passed in between, including landing exactly on one', () => {
    expect(crossedMilestones(9 * H, 10 * H)).toEqual([10]);
    expect(crossedMilestones(40 * H, 120 * H)).toEqual([50, 100]);
  });
  test('none when already past or not reached', () => {
    expect(crossedMilestones(10 * H, 49 * H)).toEqual([]);
    expect(crossedMilestones(0, 9 * H)).toEqual([]);
  });
});

describe('admin milestones', () => {
  afterEach(() => setRules(null));

  test('follow the XP rules set on /admin', () => {
    setRules({ ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, milestoneHours: [100, 1000, 2000] } });
    expect(nextMilestone(1200 * H)).toEqual({ hours: 2000, remainingMs: 800 * H });
    expect(crossedMilestones(900 * H, 2100 * H)).toEqual([1000, 2000]);
  });

  test('none when the admin removed them all', () => {
    setRules({ ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, milestoneHours: [] } });
    expect(nextMilestone(0)).toBeUndefined();
  });
});

describe('milestoneGrid', () => {
  test('one square per hour up to 1000', () => {
    expect(milestoneGrid(1000, 250.5)).toEqual({ squares: 1000, done: 250, partial: true, columns: 50 });
    expect(milestoneGrid(10, 3)).toEqual({ squares: 10, done: 3, partial: false, columns: 10 });
  });

  test('a few hours per square past 1000, at most 1000 squares', () => {
    expect(milestoneGrid(2000, 1200)).toEqual({ squares: 1000, done: 600, partial: false, columns: 50 });
    expect(milestoneGrid(10000, 15)).toEqual({ squares: 1000, done: 1, partial: true, columns: 50 });
  });
});
