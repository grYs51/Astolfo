import { weekdayRow } from '../heatmap-grid';

const DAY_MS = 24 * 60 * 60 * 1000;
export const toDate = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * Lays the days from `start` to `end` ('YYYY-MM-DD') out in Monday-first week
 * columns: `dates[column][row]` ('' outside the range) and a month label on
 * the first column of each month.
 */
export function calendarWeeks(start: string, end: string) {
  const first = toDate(start).getTime();
  const last = toDate(end).getTime();
  const monday = first - weekdayRow(toDate(start).getUTCDay()) * DAY_MS;
  const dates: string[][] = [];
  const months: string[] = [];
  for (let week = monday; week <= last; week += 7 * DAY_MS) {
    const column = Array.from({ length: 7 }, (_, row) => {
      const day = week + row * DAY_MS;
      return day < first || day > last ? '' : new Date(day).toISOString().slice(0, 10);
    });
    // Label the column holding the 1st (a label on the partial first month could collide with the next)
    const firstOfMonth = column.find((date) => date.endsWith('-01'));
    months.push(firstOfMonth ? toDate(firstOfMonth).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }) : '');
    dates.push(column);
  }
  return { dates, months };
}
