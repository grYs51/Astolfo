import type { WrappedStats } from '@nx-stolfo/api-interfaces';
import { renderPng } from './render';
import { THEMES } from './themes';
import { formatHours, wrappedCard, WrappedCardData } from './wrapped.card';

const H = 60 * 60 * 1000;

const wrapped = (overrides: Partial<WrappedStats> = {}): WrappedStats => ({
  year: 2026,
  voiceMs: 312 * H,
  sessions: 406,
  longestSessionMs: 8.75 * H,
  favouriteChannelId: 'vc1',
  topDuo: { memberId: 'b', togetherMs: 81 * H },
  peakMonth: { month: 11, voiceMs: 49 * H },
  longestStreak: 23,
  milestones: [100, 250],
  messages: 12_840,
  voiceRank: { rank: 2, members: 57, topPercent: 4 },
  xp: { gained: 14_200, levelFrom: 4, levelTo: 19 },
  ...overrides,
});

const data = (overrides: Partial<WrappedCardData> = {}): WrappedCardData => ({
  wrapped: wrapped(),
  member: { name: '<b>Astolfo</b>' },
  serverName: 'Paladins',
  favouriteChannelName: 'general & chill',
  duoName: 'Bradamante',
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
    expect(svg).toContain('>Bradamante<');
    expect(svg).toContain('81 hours together');
    expect(svg).toContain('>November<');
    expect(svg).toContain('>23 days<');
    expect(svg).toContain('>12,840<');
    expect(svg).toContain('>100h · 250h<');
    expect(svg).toContain('Level 4 → 19');
    expect(svg).toContain('+14,200 XP');
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
          favouriteChannelId: null,
          topDuo: null,
          peakMonth: null,
          longestStreak: 0,
          milestones: [],
          messages: 3,
          voiceRank: null,
          xp: { gained: 0, levelFrom: 2, levelTo: 2 },
        }),
        favouriteChannelName: undefined,
        duoName: undefined,
      }),
      THEMES.light
    );
    expect(svg).not.toMatch(/Top \d+%/);
    expect(svg).toContain('none this year');
    expect(svg).toContain('no XP this year');
    expect(svg).not.toContain('together');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(wrappedCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
