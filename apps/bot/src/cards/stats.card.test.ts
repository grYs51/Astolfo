import type { MemberSummary } from '../stats/queries';
import { renderPng } from './render';
import { STATS_CARD_SECTIONS, statsCard, StatsCardData } from './stats.card';
import { THEMES } from './themes';

const H = 60 * 60 * 1000;

const summary = (overrides: Partial<MemberSummary> = {}): MemberSummary => ({
  voiceMs: 4 * H,
  previousVoiceMs: 2 * H,
  sessions: 2,
  messages: 1234,
  previousMessages: 2000,
  voiceRank: 1,
  rankedMembers: 3,
  messageRank: 2,
  favouriteChannelId: 'vc1',
  companions: [
    { memberId: '200', togetherMs: 2 * H },
    { memberId: '300', togetherMs: H },
  ],
  streak: { current: 3, longest: 7 },
  lifetimeMs: 88 * H,
  ...overrides,
});

const data = (overrides: Partial<StatsCardData> = {}): StatsCardData => ({
  summary: summary(),
  period: 'week',
  memberName: 'Astolfo',
  serverName: 'Paladins',
  favouriteChannelName: 'general & chill',
  companions: [{ name: 'Roland' }, { name: '<b>Oliver</b>' }],
  ...overrides,
});

/** The data the optional sections need */
const sections = (): Partial<StatsCardData> => ({
  habits: { voice: 4 * H, muted: 2 * H, deafened: H, video: 30 * 60_000, streaming: 0 },
  calendar: {
    start: '2025-11-10',
    end: '2026-11-10',
    days: [
      { date: '2026-01-05', minutes: 120, messages: 3 },
      { date: '2026-03-02', minutes: 0, messages: 4 },
    ],
  },
  heatmap: [{ day: 1, hour: 20, minutes: 90 }],
});

describe('statsCard', () => {
  it('shows voice, messages, rank and sessions with the change', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('>4h<');
    expect(svg).toContain('↑ 100% vs the week before');
    expect(svg).toContain('>1,234<');
    expect(svg).toContain('↓ 38% vs the week before');
    expect(svg).toContain('>#1<');
    expect(svg).toContain('of 3 members · #2 in messages');
    expect(svg).toContain('avg 2h · most in #general &amp; chill');
  });

  it('shows the voice streak and the next milestone with its progress', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('>Voice streak<');
    expect(svg).toContain('>3 days<');
    expect(svg).toContain('best 7');
    expect(svg).toContain('>100h<');
    expect(svg).toContain('12h to go');
    // 88 of 100 hours, on a bar as wide as the tile minus its padding
    const barW = (800 - 64 - 16) / 2 - 48;
    expect(svg).toContain(`width="${0.88 * barW}" height="8"`);
  });

  it('leaves out the streak line when there is no streak and no milestone left', () => {
    const svg = statsCard(data({ summary: summary({ streak: { current: 0, longest: 0 }, lifetimeMs: 1000 * H }) }), THEMES.dark);
    expect(svg).not.toContain('Voice streak');
    expect(svg).not.toContain('Next milestone');
  });

  it('lists companions with escaped names', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('You hang out most with');
    expect(svg).toContain('>Roland<');
    expect(svg).toContain('&lt;b&gt;Oliver&lt;/b&gt;');
    expect(svg).toContain('>2h<');
  });

  it('leaves out the companions block and rank when there are none', () => {
    const svg = statsCard(data({ summary: summary({ companions: [], voiceRank: undefined }), companions: [] }), THEMES.dark);
    expect(svg).not.toContain('You hang out most with');
    expect(svg).toContain('>–<');
  });

  it('says so when there was no activity', () => {
    const svg = statsCard(data({ summary: summary({ sessions: 0, messages: 0, companions: [] }), period: 'all' }), THEMES.light);
    expect(svg).toContain('over all time.');
    expect(svg).not.toContain('Voice time');
  });

  it('draws only the default sections when none are picked (/stats)', () => {
    const svg = statsCard(data(sections()), THEMES.dark);
    expect(svg).not.toContain('Voice habits');
    expect(svg).not.toContain('Past year');
    expect(svg).not.toContain('in voice<');
  });

  it('draws the voice habits', () => {
    const svg = statsCard(data({ ...sections(), sections: ['habits'] }), THEMES.dark);
    expect(svg).toContain('Voice habits');
    expect(svg).toContain('>Camera on<');
    expect(svg).toContain('>30m<');
    expect(svg).toContain('>3h<'); // listening: 4h of voice, 1h deafened
    expect(svg).toContain('>50%<');
    expect(svg).not.toContain('Voice time');
    expect(svg).not.toContain('You hang out most with');
  });

  it('leaves out the habits without voice time', () => {
    const svg = statsCard(data({ ...sections(), sections: ['habits'], habits: { voice: 0, muted: 0, deafened: 0, video: 0, streaming: 0 } }), THEMES.dark);
    expect(svg).not.toContain('Voice habits');
  });

  it('draws a square per day of the past year, with month labels', () => {
    const svg = statsCard(data({ ...sections(), sections: ['calendar'] }), THEMES.dark);
    expect(svg).toContain('Past year · 2 active days');
    // 2025-11-10 to 2026-11-10: 366 days, plus the header avatar has no rx="2"
    expect(svg.match(/rx="2"/g)).toHaveLength(366);
    // the busiest day is full strength, a message-only day the lightest level
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).toContain('fill-opacity="0.3"');
    expect(svg).toContain('>Jan<');
  });

  it('says so when the picked parts have nothing to draw', () => {
    const svg = statsCard(
      data({ ...sections(), sections: ['habits', 'companions'], habits: { voice: 0, muted: 0, deafened: 0, video: 0, streaming: 0 }, summary: summary({ companions: [] }) }),
      THEMES.dark
    );
    expect(svg).toContain('Nothing to show in these parts over the past week.');
  });

  it('shows the calendar even when the period is empty', () => {
    const svg = statsCard(
      data({ ...sections(), sections: ['calendar', 'totals'], summary: summary({ sessions: 0, messages: 0, companions: [] }) }),
      THEMES.dark
    );
    expect(svg).toContain('Past year');
    expect(svg).not.toContain('Voice time');
  });

  it('draws the weekly heatmap in the viewer’s words', () => {
    const svg = statsCard(data({ ...sections(), sections: ['heatmap'], self: false }), THEMES.dark);
    expect(svg).toContain('When they’re in voice');
    expect(svg.match(/rx="2"/g)).toHaveLength(7 * 24);
    expect(svg).toContain('>Mon<');
    expect(svg).toContain('>18:00<');
  });

  it('renders to a PNG with every section', async () => {
    const png = await renderPng(statsCard(data({ ...sections(), sections: STATS_CARD_SECTIONS }), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
