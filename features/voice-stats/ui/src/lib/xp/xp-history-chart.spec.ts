import type { XpHistory } from '@nx-stolfo/data-access-voice-stats';
import { historyChartOption, pointLabel } from './xp-history-chart';

const history = (patch: Partial<XpHistory> = {}): XpHistory => ({
  granularity: 'day',
  startXp: 2400,
  points: [
    { date: '2026-11-11', gained: 0, total: 2400 },
    { date: '2026-11-12', gained: 1340, total: 3740 },
  ],
  levels: [{ level: 9, xp: 2700 }],
  ...patch,
});

describe('xp history chart', () => {
  it('hover reads the day, or the week, and what was gained in it', () => {
    const h = history();
    expect(pointLabel(h, h.points[1])).toBe('Thu 12 Nov · +1,340 XP');
    expect(pointLabel({ ...h, granularity: 'week' }, { date: '2026-11-09', gained: 340, total: 0 })).toBe('Week of 9 Nov · +340 XP');
  });

  it('the line starts at the real total, with a dashed line per level', () => {
    const option = historyChartOption(history());
    expect(option.yAxis.min).toBe(2400);
    expect(option.series[0].data).toEqual([2400, 3740]);
    expect(option.series[0].markLine.data).toEqual([{ name: 'Lv 9', yAxis: 2700 }]);
  });

  it('a flat line still gets a range', () => {
    const option = historyChartOption(history({ points: [{ date: '2026-11-12', gained: 0, total: 2400 }], levels: [] }));
    expect(option.yAxis.max({ max: 2400 })).toBe(2401);
  });
});
