import { DEFAULT_RULES, setRules } from '../xp/rules';
import { crossedMilestones, milestoneGrid, nextMilestone } from './milestones';

const H = 60 * 60 * 1000;

describe('nextMilestone', () => {
  test('the first threshold above the total, with what is left', () => {
    expect(nextMilestone(0)).toMatchObject({ hours: 10, remainingMs: 10 * H });
    expect(nextMilestone(88 * H)).toMatchObject({ hours: 100, remainingMs: 12 * H });
  });
  test('exactly on a threshold points at the next one', () => {
    expect(nextMilestone(50 * H)).toMatchObject({ hours: 100, remainingMs: 50 * H });
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
    expect(nextMilestone(1200 * H)).toEqual({ hours: 2000, remainingMs: 800 * H, squares: 100, perSquare: 20, done: 60, partial: false });
    expect(crossedMilestones(900 * H, 2100 * H)).toEqual([1000, 2000]);
  });

  test('none when the admin removed them all', () => {
    setRules({ ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, milestoneHours: [] } });
    expect(nextMilestone(0)).toBeUndefined();
  });
});

describe('milestoneGrid', () => {
  test('one square per hour up to 100 h', () => {
    expect(milestoneGrid(10, 3)).toEqual({ squares: 10, perSquare: 1, done: 3, partial: false });
    expect(milestoneGrid(50, 20.5)).toEqual({ squares: 50, perSquare: 1, done: 20, partial: true });
  });

  test('past 100 h, a 20×5 grid where one square is 1%', () => {
    expect(milestoneGrid(2000, 1200)).toEqual({ squares: 100, perSquare: 20, done: 60, partial: false });
    expect(milestoneGrid(250, 6)).toEqual({ squares: 100, perSquare: 2.5, done: 2, partial: true });
    expect(milestoneGrid(10000, 15)).toEqual({ squares: 100, perSquare: 100, done: 0, partial: true });
  });
});
