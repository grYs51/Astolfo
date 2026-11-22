import type { WrappedStats } from '@nx-stolfo/api-interfaces';
import { renderPng } from './render';
import { fitValue } from './svg';
import { THEMES } from './themes';
import { formatHours, rankText, wrappedCard, WrappedCardData } from './wrapped.card';

const H = 60 * 60 * 1000;
const MONTH_HOURS = [18, 22, 15, 20, 26, 31, 35, 28, 24, 30, 49, 14];

const xp = (overrides: Partial<WrappedStats['xp']> = {}): WrappedStats['xp'] => ({
  gained: 14_200,
  levelFrom: 4,
  levelTo: 19,
  levelUps: 15,
  rank: { rank: 3, members: 41, topPercent: 8 },
  sources: [
    { group: 'voice', xp: 8_520, share: 0.6 },
    { group: 'messages', xp: 2_840, share: 0.2 },
    { group: 'games', xp: 1_420, share: 0.1 },
    { group: 'streaks', xp: 1_420, share: 0.1 },
    { group: 'bonuses', xp: 0, share: 0 },
  ],
  bestDay: { date: '2026-11-07', xp: 1_240 },
  weeklyTop3: 6,
  ...overrides,
});

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
    { memberId: 'c', togetherMs: 9 * H },
    { memberId: 'd', togetherMs: 59 * 60_000 + 1_000 },
  ],
  months: MONTH_HOURS.map((hours, i) => ({ month: i + 1, voiceMs: hours * H, messages: 1000, xp: 1000 })),
  peakMonth: { month: 11, voiceMs: 49 * H, messages: 1000, xp: 1000 },
  hours: Array.from({ length: 24 }, (_, h) => (h === 21 ? 900 : h >= 18 ? 500 : 0)),
  persona: { label: 'Evening regular', peakHour: 21 },
  days: { start: '2026-01-01', end: '2026-11-22', days: [{ date: '2026-03-04', minutes: 90, messages: 2 }] },
  longestStreak: 23,
  milestones: [100, 250],
  messages: 12_840,
  voiceRank: { rank: 2, members: 57, topPercent: 4 },
  xp: xp(),
  games: { rockPaperScissors: 3, ticTacToe: 0, trivia: 12 },
  ...overrides,
});

const data = (overrides: Partial<WrappedCardData> = {}): WrappedCardData => ({
  wrapped: wrapped(),
  member: { name: '<b>Astolfo</b>' },
  serverName: 'Paladins',
  channelNames: ['general & chill', 'gaming', undefined],
  buddies: [{ name: 'Bradamante, Knight of the Silver Lance' }, { name: 'Roland' }, { name: 'Oliver' }],
  ...overrides,
});

describe('formatHours', () => {
  it('uses one style: whole hours from 10, one decimal below, minutes under an hour, never seconds', () => {
    expect(formatHours(312.4 * H)).toBe('312 hours');
    expect(formatHours(9 * H)).toBe('9 hours');
    expect(formatHours(2.9 * H)).toBe('2.9 hours');
    expect(formatHours(H)).toBe('1 hour');
    expect(formatHours(59 * 60_000 + 1_000)).toBe('59 min');
  });
});

describe('rankText', () => {
  it('says "Top x%" only for the top half', () => {
    expect(rankText({ rank: 2, members: 57, topPercent: 4 }, 'voice members')).toEqual({ big: 'Top 4%', sub: '#2 of 57 voice members' });
    expect(rankText({ rank: 5, members: 10, topPercent: 50 }, 'voice members').big).toBe('Top 50%');
    expect(rankText({ rank: 7, members: 10, topPercent: 70 }, 'voice members')).toEqual({ big: '#7 of 10', sub: 'voice members' });
  });
});

describe('fitValue', () => {
  it('keeps short values big, wraps long ones onto two lines at 20 px before shrinking', () => {
    expect(fitValue('Roland', 312, 30)).toEqual({ size: 30, lines: ['Roland'] });
    expect(fitValue('Bradamante, Knight of the Silver Lance', 312, 30)).toEqual({ size: 20, lines: ['Bradamante, Knight of the', 'Silver Lance'] });
    const huge = fitValue('A'.repeat(90), 312, 30);
    expect(huge.size).toBe(14);
    expect(huge.lines).toHaveLength(2);
    expect(huge.lines[1].endsWith('…')).toBe(true);
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
    expect(svg).toContain('>8.8 hours<');
    expect(svg).toContain('>#general &amp; chill<');
    expect(svg).toContain('81 hours together');
    expect(svg).toContain('>November<');
    expect(svg).toContain('>23 days<');
    expect(svg).toContain('>12,840<');
    expect(svg).toContain('>100h · 250h<');
    expect(svg).toContain('>15<'); // games won
    expect(svg).toContain('3 RPS · 12 trivia');
  });

  it('puts a long top duo name on two lines at 20 px', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('font-size="20" fill="#F2F3F5" font-weight="700">Bradamante, Knight of the<');
    expect(svg).toContain('font-size="20" fill="#F2F3F5" font-weight="700">Silver Lance<');
  });

  it('draws the XP block: total, levels, rank, sources and the extras', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('>14,200 XP<');
    expect(svg).toContain('Level 4 → 19 · 15 level-ups');
    expect(svg).toContain('>Top 8%<');
    expect(svg).toContain('#3 of 41 by XP earned');
    expect(svg).toContain('>Voice 60%<');
    expect(svg).toContain('>Bonuses 0%<');
    expect(svg).toContain('clip-path="url(#xpbar)"');
    expect(svg).toContain('Best day 7 Nov · 1,240 XP · 6× in the weekly top 3');
  });

  it('shows the place, not "Top x%", below the top half', () => {
    const svg = wrappedCard(
      data({ wrapped: wrapped({ voiceRank: { rank: 7, members: 10, topPercent: 70 }, xp: xp({ rank: { rank: 9, members: 12, topPercent: 75 } }) }) }),
      THEMES.dark
    );
    expect(svg).not.toMatch(/Top \d+%/);
    expect(svg).toContain('>#7 of 10<');
    expect(svg).toContain('>voice members<');
    expect(svg).toContain('>#9 of 12<');
  });

  it('draws the charts with durations in one style and no seconds', () => {
    const svg = wrappedCard(data(), THEMES.dark);
    expect(svg).toContain('Voice by month · most in November');
    // One bar per month, the peak in full accent, the rest dimmed
    expect(svg.match(new RegExp(`fill="${THEMES.dark.accent}" fill-opacity="0.4"`, 'g'))?.length).toBeGreaterThanOrEqual(11);
    expect(svg).toContain('>Roland<');
    expect(svg).toContain('>9 hours<');
    expect(svg).toContain('>59 min<');
    expect(svg).not.toMatch(/\d+s</);
    expect(svg).toContain('>#gaming<');
    // A channel @everyone can't see isn't named
    expect(svg).toContain('>Private channel<');
    expect(svg).toContain('Evening regular · busiest at 21:00');
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
          months: MONTH_HOURS.map((_, i) => ({ month: i + 1, voiceMs: 0, messages: 0, xp: 0 })),
          peakMonth: null,
          hours: Array(24).fill(0),
          persona: null,
          days: { start: '2025-01-01', end: '2025-12-31', days: [] },
          longestStreak: 0,
          milestones: [],
          messages: 3,
          voiceRank: null,
          xp: xp({ gained: 0, levelFrom: 2, levelTo: 2, levelUps: 0, rank: null, bestDay: null, weeklyTop3: 0 }),
          games: { rockPaperScissors: 0, ticTacToe: 0, trivia: 0 },
        }),
        channelNames: [],
        buddies: [],
      }),
      THEMES.light
    );
    expect(svg).not.toMatch(/Top \d+%/);
    expect(svg).toContain('none this year');
    expect(svg).toContain('>0 XP<');
    expect(svg).toContain('>Level 2<');
    expect(svg).not.toContain('xpbar');
    expect(svg).not.toContain('together');
    expect(svg).not.toContain('Buddies');
    expect(svg).toContain('No voice this year');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(wrappedCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
