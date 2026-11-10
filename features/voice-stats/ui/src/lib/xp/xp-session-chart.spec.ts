import type { XpSegment } from '@nx-stolfo/data-access-voice-stats';
import { breakdown, sessionChartOption } from './xp-session-chart';

const M = 60_000;
const seg = (from: number, to: number, memberIds: string[], extra: Partial<XpSegment> = {}): XpSegment => ({
  from: from * M,
  to: to * M,
  memberIds,
  deaf: false,
  crowd: memberIds.length === 0 ? 0.5 : memberIds.length === 1 ? 1 : 1.12,
  stay: 1,
  media: 1,
  camera: false,
  streaming: false,
  multiplier: memberIds.length === 0 ? 0.5 : memberIds.length === 1 ? 1 : 1.12,
  ...extra,
});
const people = {
  alex: { id: 'alex', username: 'alex', displayName: 'Alex', avatar: 'https://cdn.example/alex.png' },
  sam: { id: 'sam', username: 'sam', displayName: null, avatar: null },
};

// The user's sketch: alone, Alex joins, Sam joins, deafened, undeafened
const segments = [
  seg(0, 5, []),
  seg(5, 10, ['alex']),
  seg(10, 15, ['alex', 'sam']),
  seg(15, 20, ['alex', 'sam'], { deaf: true, multiplier: 0.28 }),
  seg(20, 25, ['alex', 'sam']),
  seg(25, 30, ['sam']),
];

describe('sessionChartOption', () => {
  const series = sessionChartOption(segments, people).series[0];

  it('builds one point per segment and one at the end', () => {
    expect(series.data).toEqual([
      [0, 0.5],
      [5 * M, 1],
      [10 * M, 1.12],
      [15 * M, 0.28],
      [20 * M, 1.12],
      [25 * M, 1],
      [30 * M, 1],
    ]);
    expect(series.step).toBe('end');
  });

  it('marks every change in who is there: an avatar above for each join, below for each leave', () => {
    const avatars = { alex: 'data:alex', sam: 'data:sam' };
    const marks = sessionChartOption(segments, people, avatars).series[0].markPoint.data;
    expect(marks.map((m) => [m.name, m.coord, m.symbol, m.symbolOffset[1] < 0 ? 'above' : 'below'])).toEqual([
      ['Alex joined', [5 * M, 1], 'image://data:alex', 'above'],
      ['sam joined', [10 * M, 1.12], 'image://data:sam', 'above'],
      ['Alex left', [25 * M, 1], 'image://data:alex', 'below'],
    ]);
    // Before the round avatars load: a dot
    expect(series.markPoint.data[0]).toMatchObject({ symbol: 'circle' });
  });

  it('an avatar has its own tooltip: who, what and when, the name escaped', () => {
    const tip = series.markPoint.tooltip.formatter({ name: '<b>Alex</b> joined', data: { coord: [5 * M, 1] } });
    expect(tip).toMatch(/^&lt;b&gt;Alex&lt;\/b&gt; joined at \d{1,2}[:.]\d{2}/);
  });

  it('shades only the deafened stretches', () => {
    expect(series.markArea.data).toEqual([[{ name: 'Deafened', xAxis: 15 * M }, { xAxis: 20 * M }]]);
  });
});

describe('breakdown', () => {
  it('names who was there and each factor', () => {
    expect(breakdown(seg(0, 1, ['alex', 'sam'], { stay: 1.1, media: 1.1, camera: true, multiplier: 1.3552 }), people)).toBe(
      'Alex, sam: 2 others 1.12× · stay 1.1× · camera +10% = 1.3552×'
    );
    expect(breakdown(seg(0, 1, [], { deaf: true, multiplier: 0.125 }), people)).toBe('Alone 0.5× · deafened 0.25× = 0.125×');
  });
});
