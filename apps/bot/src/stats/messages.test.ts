import {
  dashboardUrlFor,
  formatChange,
  formatDuration,
} from './messages';
const H = 60 * 60 * 1000;
describe('formatDuration', () => {
  test.each([
    [30_000, '30s'],
    [45 * 60_000, '45m'],
    [17 * H + 45 * 60_000, '17h 45m'],
    [3 * H, '3h'],
    [50 * H + 20 * 60_000, '2d 2h'], // two largest units only
  ])('%i ms → %s', (ms, expected) => expect(formatDuration(ms)).toBe(expected));
});

describe('formatChange', () => {
  test('up and down', () => {
    expect(formatChange(120, 100, 'the week before')).toBe('↑ 20% vs the week before');
    expect(formatChange(50, 100, 'the week before')).toBe('↓ 50% vs the week before');
  });
  test('nothing to compare', () => {
    expect(formatChange(10, null, '')).toBeUndefined(); // 'all' has no previous period
    expect(formatChange(0, 0, 'x')).toBeUndefined();
  });
  test('from zero and unchanged', () => {
    expect(formatChange(5, 0, 'the week before')).toBe('new vs the week before');
    expect(formatChange(100, 100, 'the week before')).toBe('same as the week before');
  });
});

describe('dashboard link', () => {
  const original = process.env.CLIENT_URL;
  afterEach(() => {
    process.env.CLIENT_URL = original;
  });

  test('built from CLIENT_URL, without a double slash', () => {
    process.env.CLIENT_URL = 'https://astolfo.example/';
    expect(dashboardUrlFor('g')).toBe('https://astolfo.example/overview/detail/g');
  });

  test('opens on the same period, tab and member as the reply', () => {
    process.env.CLIENT_URL = 'https://astolfo.example';
    expect(dashboardUrlFor('g', { period: 'week' })).toBe('https://astolfo.example/overview/detail/g?period=week');
    // month is the dashboard's default, so it stays out of the URL
    expect(dashboardUrlFor('g', { period: 'month' })).toBe('https://astolfo.example/overview/detail/g');
    expect(dashboardUrlFor('g', { period: 'all', tab: 'server' })).toBe(
      'https://astolfo.example/overview/detail/g?period=all&tab=server'
    );
    expect(dashboardUrlFor('g', { memberId: 'm' })).toBe('https://astolfo.example/overview/detail/g/members/m');
  });

  test('left out when CLIENT_URL is missing or not absolute', () => {
    Reflect.deleteProperty(process.env, 'CLIENT_URL');
    expect(dashboardUrlFor('g')).toBeUndefined();
    process.env.CLIENT_URL = 'astolfo.example';
    expect(dashboardUrlFor('g')).toBeUndefined();
  });
});
