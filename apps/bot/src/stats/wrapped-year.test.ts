import { latestWrappedYear } from './wrapped-year';

test.each([
  ['2026-01-01T00:00:00Z', 2025],
  ['2026-11-30T23:59:59Z', 2025],
  ['2026-12-01T00:00:00Z', 2026],
  ['2026-12-31T23:59:59Z', 2026],
])('at %s the latest Wrapped is %i', (at, year) => {
  expect(latestWrappedYear(new Date(at))).toBe(year);
});
