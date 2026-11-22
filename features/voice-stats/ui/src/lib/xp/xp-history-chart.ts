import type { XpHistory } from '@nx-stolfo/data-access-voice-stats';

/** A local date (YYYY-MM-DD) as "Tue 12 Nov" */
const dayLabel = (date: string, weekday = true) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    ...(weekday && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/** "Tue 12 Nov · +340 XP", or "Week of 11 Nov · +340 XP" */
export const pointLabel = (history: XpHistory, point: XpHistory['points'][number]) =>
  `${history.granularity === 'week' ? `Week of ${dayLabel(point.date, false)}` : dayLabel(point.date)} · +${point.gained.toLocaleString('en-GB')} XP`;

const AXIS = { axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } } };

/** The ECharts option for the running XP total, with a dashed line per level crossed */
export const historyChartOption = (history: XpHistory) => ({
  grid: { left: 8, right: 48, top: 16, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    textStyle: { color: '#f3f4f6' },
    formatter: (params: { dataIndex: number }[]) => pointLabel(history, history.points[params[0]?.dataIndex ?? 0]),
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: history.points.map((p) => dayLabel(p.date, false)),
    ...AXIS,
  },
  // From the real total at the start, and no higher than the data: level lines never stretch it
  yAxis: {
    type: 'value',
    min: history.startXp,
    // A flat line (nothing earned) still needs a range to draw in
    max: (value: { max: number }) => Math.max(value.max, history.startXp + 1),
    ...AXIS,
    splitLine: { show: false },
  },
  series: [
    {
      type: 'line',
      symbol: 'none',
      lineStyle: { color: '#a855f7', width: 2 },
      areaStyle: { color: 'rgba(168, 85, 247, 0.12)' },
      data: history.points.map((p) => p.total),
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#6b7280', type: 'dashed' },
        label: { color: '#9ca3af', formatter: '{b}', position: 'end' },
        data: history.levels.map((l) => ({ name: `Lv ${l.level}`, yAxis: l.xp })),
      },
    },
  ],
});
