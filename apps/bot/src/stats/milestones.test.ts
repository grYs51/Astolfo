import { crossedMilestones, nextMilestone } from './milestones';

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
