import type { WrappedStats } from '@nx-stolfo/api-interfaces';
import { renderPng } from './render';
import { THEMES } from './themes';
import { formatHours, wrappedCard, WrappedCardData } from './wrapped.card';

const H = 60 * 60 * 1000;
const MONTH_HOURS = [18, 22, 15, 20, 26, 31, 35, 28, 24, 30, 49, 14];

const wrapped = (overrides: Partial<WrappedStats> = {}): WrappedStats => ({
  year: 2026,
  voiceMs: 312 * H,
  sessions: 406,
  longestSessionMs: 8.75 * H,
  topChannels: [
    { channelId: 'vc1', voiceMs: 190 * H },
    { channelId: 'vc2', voiceMs: 84 * H },
    { channelId: 'vc3', voiceMs: 31 * H },
  ],
  buddies: [
    { memberId: 'b', togetherMs: 81 * H },
    { memberId: 'c', togetherMs: 40 * H },
  ],
  months: MONTH_HOURS.map((hours, i) => ({ month: i + 1, voiceMs: hours * H, messages: 1000 })),
  peakMonth: { month: 11, voiceMs: 49 * H, messages: 1000 },
  hours: Array.from({ length: 24 }, (_, h) => (h === 21 ? 900 : h >= 18 ? 500 : 0)),
  persona: { label: 'Evening regular', peakHour: 21 },
  days: { start: '2026-01-01', end: '2026-11-22', days: [{ date: '2026-03-04', minutes: 90, messages: 2 }] },
  longestStreak: 23,
  milestones: [100, 250],
  messages: 12_840,
  voiceRank: { rank: 2, members: 57, topPercent: 4 },
  xp: { gained: 14_200, levelFrom: 4, levelTo: 19 },
  games: { rockPaperScissors: 3, ticTacToe: 0, trivia: 12 },
  ...overrides,
});

const data = (overrides: Partial<WrappedCardData> = {}): WrappedCardData => ({
  wrapped: wrapped(),
  member: { name: '<b>Astolfo</b>' },
  serverName: 'Paladins',
  channelNames: ['general & chill', 'gaming', undefined],
  buddies: [{ name: 'Bradamante, Knight of the Silver Lance' }, { name: 'Roland' }],
  ...overrides,
});

describe('formatHours', () => {
  it('rounds to hours from 10h, keeps minutes below', () => {
    expect(formatHours(312.4 * H)).toBe('312 hours');
    expect(formatHours(2.5 * H)).toBe('2h 30m');
  });
});

describe('wrappedCard', () => {
  it('shows the year', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('>2026 Wrapped<');
    expect(svg).toContain('>312 hours<');
    expect(svg).toContain('>406 sessions<');
    expect(svg).toContain('>Top 4%<');
    expect(svg).toContain('#2 of 57 voice members');
    expect(svg).toContain('>8h 45m<');
    expect(svg).toContain('>#general &amp; chill<');
    expect(svg).toContain('81 hours together');
    expect(svg).toContain('>November<');
    expect(svg).toContain('>23 days<');
    expect(svg).toContain('>12,840<');
    expect(svg).toContain('>100h · 250h<');
    expect(svg).toContain('Level 4 → 19');
    expect(svg).toContain('+14,200 XP');
  });

  it('fits a long top duo name by shrinking it instead of cutting it', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toMatch(/font-size="(1[4-9]|2\d)"[^>]*>Bradamante, Knight of the Silver Lance</);
  });

  it('draws the charts: months with the peak, buddies, channels, hours with the persona, games, calendar', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('Voice by month · most in November');
    // One bar per month, the peak in full accent, the rest dimmed
    expect(svg.match(new RegExp(`fill="${THEMES.dark.accent}" fill-opacity="0.4"`, 'g'))?.length).toBeGreaterThanOrEqual(11);
    expect(svg).toContain('>Roland<');
    expect(svg).toContain('>40 hours<');
    expect(svg).toContain('>#gaming<');
    // A channel @everyone can't see isn't named
    expect(svg).toContain('>Private channel<');
    expect(svg).toContain('Evening regular · busiest at 21:00');
    expect(svg).toContain('3 rock paper scissors wins · 12 trivia answers right');
    expect(svg).toContain('2026 · 1 active day');
  });

  it('has a short footer', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('>Paladins · 2026<');
    expect(svg).not.toContain('open sessions count live');
  });

  it('escapes the member name', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('&lt;b&gt;Astolfo&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('copes with a quiet year', () => {
    const svg = wrappedCard(
      data({
        wrapped: wrapped({
          voiceMs: 0,
          sessions: 0,
          longestSessionMs: 0,
          topChannels: [],
          buddies: [],
          months: MONTH_HOURS.map((_, i) => ({ month: i + 1, voiceMs: 0, messages: 0 })),
          peakMonth: null,
          hours: Array(24).fill(0),
          persona: null,
          days: { start: '2025-01-01', end: '2025-12-31', days: [] },
          longestStreak: 0,
          milestones: [],
          messages: 3,
          voiceRank: null,
          xp: { gained: 0, levelFrom: 2, levelTo: 2 },
          games: { rockPaperScissors: 0, ticTacToe: 0, trivia: 0 },
        }),
        channelNames: [],
        buddies: [],
      }),
      THEMES.light
    );
    expect(svg).not.toMatch(/Top \d+%/);
    expect(svg).toContain('none this year');
    expect(svg).toContain('no XP this year');
    expect(svg).not.toContain('together');
    expect(svg).not.toContain('Buddies');
    expect(svg).not.toContain('>Games<');
    expect(svg).toContain('No voice this year');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(wrappedCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
