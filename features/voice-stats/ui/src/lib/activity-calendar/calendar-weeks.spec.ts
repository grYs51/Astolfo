import { calendarWeeks, toDate } from './calendar-weeks';

// Same shape as the API: 365 days ending today, so start and end share a weekday
describe.each([
  ['starting and ending on a Monday', '2025-11-10', '2026-11-09'],
  ['starting and ending on a Sunday', '2025-03-30', '2026-03-29'],
  ['starting and ending on a Wednesday', '2025-11-12', '2026-11-11'],
])('calendarWeeks %s', (_, start, end) => {
  const { dates, months } = calendarWeeks(start, end);
  const days = dates.flat().filter(Boolean);

  it('lays out 53 week columns holding every day once, in order', () => {
    expect(dates).toHaveLength(53);
    expect(months).toHaveLength(53);
    expect(days).toHaveLength(365);
    expect(days[0]).toBe(start);
    expect(days.at(-1)).toBe(end);
    expect([...days].sort()).toEqual(days);
  });

  it('puts Monday in row 0 and Sunday in row 6', () => {
    dates.forEach((column) =>
      column.forEach((date, row) => {
        if (date) expect((toDate(date).getUTCDay() + 6) % 7).toBe(row);
      })
    );
  });

  it('leaves the cells outside the range blank', () => {
    const firstRow = (toDate(start).getUTCDay() + 6) % 7;
    const lastRow = (toDate(end).getUTCDay() + 6) % 7;
    expect(dates[0].slice(0, firstRow).every((date) => date === '')).toBe(true);
    expect(dates.at(-1)?.slice(lastRow + 1).every((date) => date === '')).toBe(true);
  });

  it('labels the column holding each 1st of the month, never two in a row', () => {
    const labelled = months.flatMap((label, column) => (label ? [column] : []));
    expect(labelled).toHaveLength(12);
    labelled.forEach((column) => expect(dates[column].some((date) => date.endsWith('-01'))).toBe(true));
    labelled.slice(1).forEach((column, i) => expect(column - labelled[i]).toBeGreaterThan(1));
  });
});
