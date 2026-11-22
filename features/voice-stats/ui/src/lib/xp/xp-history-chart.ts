import type { XpHistory } from '@nx-stolfo/data-access-voice-stats';

/** A local date (YYYY-MM-DD) as "12 Nov", or "Tue 12 Nov" */
const dayLabel = (date: string, weekday = true) => {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
  // In parts: browsers put a comma after the weekday, Node doesn't
  const day = format({ day: 'numeric', month: 'short' });
  return weekday ? `${format({ weekday: 'short' })} ${day}` : day;
};

/** "Tue 12 Nov · +340 XP", or "Week of 11 Nov · +340 XP" */
export const pointLabel = (history: XpHistory, point: XpHistory['points'][number]) =>
  `${history.granularity === 'week' ? `Week of ${dayLabel(point.date, false)}` : dayLabel(point.date)} · +${point.gained.toLocaleString('en-GB')} XP`;

/** Labels closer than this share of the axis to the one above are left off, so low levels don't pile up */
const LABEL_GAP = 1 / 12;

/** The level lines, top down, each labelled only when it's far enough below the last label shown */
export const levelLineData = (history: XpHistory) => {
  const end = history.points[history.points.length - 1]?.total ?? history.startXp;
  const gap = (end - history.startXp) * LABEL_GAP;
  return history.levels
    .reduceRight<{ lines: { name: string; yAxis: number; label: { show: boolean } }[]; lastShown: number }>(
      ({ lines, lastShown }, l) => {
        const show = lastShown - l.xp >= gap;
        return { lines: [{ name: `Lv ${l.level}`, yAxis: l.xp, label: { show } }, ...lines], lastShown: show ? l.xp : lastShown };
      },
      { lines: [], lastShown: Infinity }
    ).lines;
};

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
        data: levelLineData(history),
      },
    },
  ],
});
