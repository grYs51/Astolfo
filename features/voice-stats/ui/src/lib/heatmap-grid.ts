/** Shared 24×7 grid labels and fill logic for the heatmap components. */

/** Heatmap rows, Monday first; the API's `dayOfWeek` goes through `weekdayRow` */
export const HEATMAP_DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** API day of week (Postgres `EXTRACT(DOW)`, 0 = Sunday) → row in `HEATMAP_DAYS_OF_WEEK` */
export const weekdayRow = (dayOfWeek: number) => (dayOfWeek + 6) % 7;

/** Hour labels: 12AM, 1AM, …, 11PM */
export const HEATMAP_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 || 12;
  const period = i < 12 ? 'AM' : 'PM';
  return `${hour}${period}`;
});

/** "Mon at 8PM" for a cell; pass a row, so an API day goes through `weekdayRow` first */
export const slotLabel = (hour: number, row: number) => `${HEATMAP_DAYS_OF_WEEK[row]} at ${HEATMAP_HOURS[hour]}`;

/**
 * Sequential single-hue ramp for "how much voice time" heatmaps; zero-value
 * cells stay close to the card surface so an empty grid reads as empty.
 */
export const HEATMAP_SEQUENTIAL_COLORS = [
  '#1c2133',
  '#2c2a4d',
  '#433370',
  '#5c3d94',
  '#7a48bd',
  '#9333ea',
  '#a855f7',
  '#c084fc',
  '#e9d5ff',
];

/** Cell key by hour and row (`weekdayRow` of the API's day of week) */
export const heatmapKey = (hour: number, row: number) => `${hour}-${row}`;

/**
 * Generates all 168 `[hour, row, value]` heatmap cells;
 * `getValue` decides what a missing cell is (0, null, …).
 */
export function buildHeatmapGrid<T = number>(
  getValue: (hour: number, row: number) => T
): [number, number, T][] {
  const cells: [number, number, T][] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      cells.push([hour, day, getValue(hour, day)]);
    }
  }
  return cells;
}
