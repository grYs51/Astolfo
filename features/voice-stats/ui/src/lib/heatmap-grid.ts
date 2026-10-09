/** Shared 24×7 grid labels and fill logic for the heatmap components. */

export const HEATMAP_DAYS_OF_WEEK = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/** Hour labels: 12AM, 1AM, …, 11PM */
export const HEATMAP_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const period = i < 12 ? 'AM' : 'PM';
  return `${hour}${period}`;
});

export const heatmapKey = (hour: number, dayOfWeek: number) =>
  `${hour}-${dayOfWeek}`;

/**
 * Generates all 168 `[hour, dayOfWeek, value]` cells for an ECharts heatmap
 * series; `getValue` decides what a missing cell is (0, null, …).
 */
export function buildHeatmapGrid<T = number>(
  getValue: (hour: number, dayOfWeek: number) => T
): [number, number, T][] {
  const cells: [number, number, T][] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      cells.push([hour, day, getValue(hour, day)]);
    }
  }
  return cells;
}
