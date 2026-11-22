import type { XpHistory } from '@nx-stolfo/data-access-voice-stats';
import { historyChartOption, levelLineData, pointLabel } from './xp-history-chart';

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
    expect(option.series[0].markLine.data).toEqual([{ name: 'Lv 9', yAxis: 2700, label: { show: true } }]);
  });

  it('every level gets a line; labels too close to the one above are left off', () => {
    // 0 to 1,200 XP: a label needs 100 XP of room
    const lines = levelLineData(history({
      startXp: 0,
      points: [{ date: '2026-11-12', gained: 1200, total: 1200 }],
      levels: [{ level: 1, xp: 100 }, { level: 2, xp: 250 }, { level: 3, xp: 450 }, { level: 4, xp: 700 }, { level: 5, xp: 1000 }],
    }));
    expect(lines.map((l) => [l.name, l.label.show])).toEqual([['Lv 1', true], ['Lv 2', true], ['Lv 3', true], ['Lv 4', true], ['Lv 5', true]]);
    const crowded = levelLineData(history({
      startXp: 0,
      points: [{ date: '2026-11-12', gained: 2400, total: 2400 }],
      levels: [{ level: 1, xp: 100 }, { level: 2, xp: 250 }, { level: 3, xp: 450 }, { level: 4, xp: 700 }],
    }));
    // 0 to 2,400 XP: 200 XP of room. Lv 3 (250 under Lv 4) and Lv 2 (200 under Lv 3) fit; Lv 1 (150 under Lv 2) doesn't
    expect(crowded.map((l) => [l.name, l.label.show])).toEqual([['Lv 1', false], ['Lv 2', true], ['Lv 3', true], ['Lv 4', true]]);
  });

  it('a flat line still gets a range', () => {
    const option = historyChartOption(history({ points: [{ date: '2026-11-12', gained: 0, total: 2400 }], levels: [] }));
    expect(option.yAxis.max({ max: 2400 })).toBe(2401);
  });
});
