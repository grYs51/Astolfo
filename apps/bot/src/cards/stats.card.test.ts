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
  messageRank: 2,
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
  companions: [{ name: 'Roland' }, { name: '<b>Oliver</b>' }],
  ...overrides,
});

/** Astolfo (4h) at `rank` of 5, between Roland and Oliver */
const ranking = (rank: 1 | 2): NonNullable<StatsCardData['ranking']> => ({
  members: 5,
  rows:
    rank === 1
      ? [
          { name: 'Astolfo', voiceMs: 4 * H, rank: 1, subject: true },
          { name: 'Roland', voiceMs: 3 * H, rank: 2, subject: false },
          { name: 'Oliver', voiceMs: 2 * H, rank: 3, subject: false },
        ]
      : [
          { name: 'Roland', voiceMs: 5 * H, rank: 1, subject: false },
          { name: 'Astolfo', voiceMs: 4 * H, rank: 2, subject: true },
          { name: 'Oliver', voiceMs: 2 * H, rank: 3, subject: false },
        ],
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
  it('leads with the change in voice time, both periods as bars, then sessions and chat rank', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('>2h more<');
    expect(svg).toContain('in voice than the week before.');
    expect(svg).toContain('>Past week<');
    expect(svg).toContain('>Week before<');
    expect(svg).toContain('>4h<');
    expect(svg).toContain('>Average session<');
    expect(svg).toContain('>#2<');
    expect(svg).toContain('1,234 messages');
  });

  it('says less, or about as long, against the previous period', () => {
    expect(statsCard(data({ summary: summary({ voiceMs: H, previousVoiceMs: 3 * H }) }), THEMES.dark)).toContain('>2h less<');
    const same = statsCard(data({ summary: summary({ voiceMs: 2 * H, previousVoiceMs: 2 * H + 30_000 }) }), THEMES.dark);
    expect(same).toContain('spent about as long in voice');
    expect(same).toContain('as the week before.');
  });

  it('gives the totals for all time, with no bars', () => {
    const svg = statsCard(data({ period: 'all', summary: summary({ previousVoiceMs: null, previousMessages: null }) }), THEMES.dark);
    expect(svg).toContain('>4h<');
    expect(svg).toContain('>1,234 messages<');
    expect(svg).toContain('over all time.');
    expect(svg).not.toContain('Past week');
  });

  it('names the member, not "you", for someone else', () => {
    const svg = statsCard(data({ self: false, memberName: 'Bradamante' }), THEMES.dark);
    expect(svg).toContain('Bradamante spent');
    expect(svg).not.toContain('You spent');
  });

  it('ranks the member between their neighbours, with the gap to the next rank', () => {
    const svg = statsCard(data({ ranking: ranking(2) }), THEMES.dark);
    expect(svg).toContain('Voice ranking · #2 of 5');
    expect(svg).toContain('>You<');
    expect(svg).toContain('>Roland<');
    expect(svg).toContain('>1h<');
    expect(svg).toContain('behind Roland for #1.');
  });

  it('says how far ahead the top member is, or that nobody else was in voice', () => {
    expect(statsCard(data({ ranking: ranking(1) }), THEMES.dark)).toContain('ahead of Roland.');
    const alone = { members: 1, rows: [{ name: 'Astolfo', voiceMs: 4 * H, rank: 1, subject: true }] };
    expect(statsCard(data({ ranking: alone }), THEMES.dark)).toContain('Nobody else was in voice over the past week.');
  });

  it('leaves out the ranking without voice time', () => {
    expect(statsCard(data(), THEMES.dark)).not.toContain('Voice ranking');
  });

  it('shows the voice streak with its pips and the next milestone as a square per hour', () => {
    const svg = statsCard(data({ sections: ['streak'] }), THEMES.dark);
    expect(svg).toContain('>Voice streak<');
    expect(svg).toContain('>3 days');
    expect(svg).toContain('· best 7');
    expect(svg).toContain('>100 hours in voice<');
    expect(svg).toContain('>12h 0m');
    expect(svg).toContain('to go<');
    // 100 squares: the 88 hours done at full strength, the rest empty
    expect(svg.match(/rx="2"/g)).toHaveLength(100);
    expect(svg.match(/fill-opacity="1"/g)).toHaveLength(88);
  });

  it('shows the level above the streak, with a bar to the next one', () => {
    const svg = statsCard(data({ sections: ['streak'], xp: { xp: 1250, level: 5, levelXp: 1000, nextLevelXp: 1500 } }), THEMES.dark);
    expect(svg).toContain('>Level<');
    expect(svg).toContain('>5<tspan');
    expect(svg).toContain('· 1,250 XP');
    expect(svg).toContain('>250 XP to level 6<');
    expect(svg.indexOf('>Level<')).toBeLessThan(svg.indexOf('>Voice streak<'));
  });

  it('marks the hour in progress', () => {
    const svg = statsCard(data({ sections: ['streak'], summary: summary({ lifetimeMs: 88.5 * H }) }), THEMES.dark);
    expect(svg.match(/fill-opacity="0.5"/g)).toHaveLength(1);
    expect(svg).toContain('>11h 30m');
  });

  it('leaves out the streak line when there is no streak and no milestone left', () => {
    const svg = statsCard(data({ summary: summary({ streak: { current: 0, longest: 0 }, lifetimeMs: 1000 * H }) }), THEMES.dark);
    expect(svg).not.toContain('Voice streak');
    expect(svg).not.toContain('hours in voice');
  });

  it('lists companions with escaped names', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('You hang out most with');
    expect(svg).toContain('>Roland<');
    expect(svg).toContain('&lt;b&gt;Oliver&lt;/b&gt;');
    expect(svg).toContain('>2h<');
  });

  it('leaves out the companions block and the chat rank when there are none', () => {
    const svg = statsCard(data({ summary: summary({ companions: [], messageRank: undefined }), companions: [] }), THEMES.dark);
    expect(svg).not.toContain('You hang out most with');
    expect(svg).toContain('>1,234 messages<');
  });

  it('says so when there was no activity', () => {
    const svg = statsCard(data({ summary: summary({ sessions: 0, messages: 0, companions: [] }), period: 'all' }), THEMES.light);
    expect(svg).toContain('over all time.');
    expect(svg).not.toContain('Sessions');
  });

  it('draws only the default sections when none are picked (/stats)', () => {
    const svg = statsCard(data(sections()), THEMES.dark);
    expect(svg).not.toContain('Voice habits');
    expect(svg).not.toContain('Past year');
    expect(svg).not.toContain('When you’re in voice');
  });

  it('draws the voice habits as meters in five parts', () => {
    const svg = statsCard(data({ ...sections(), sections: ['habits'] }), THEMES.dark);
    expect(svg).toContain('Voice habits');
    expect(svg).toContain('>Muted<');
    expect(svg).toContain('>50%<');
    expect(svg).toContain('>Camera<');
    expect(svg).toContain('>13%<'); // 30m of 4h
    expect(svg).toContain('>Streaming<');
    expect(svg).toContain('>0%<');
    expect(svg).toContain('2h of voice');
    expect(svg).not.toContain('>Online<');
    expect(svg).not.toContain('Sessions');
    expect(svg).not.toContain('You hang out most with');
  });

  it('adds the online meter when the online time is known', () => {
    const svg = statsCard(data({ ...sections(), sections: ['habits'], online: { ms: 10 * H, share: 0.42 } }), THEMES.dark);
    expect(svg).toContain('>Online<');
    expect(svg).toContain('>42%<');
    expect(svg).toContain('10h in total');
  });

  it('leaves out the habits without voice time or online time', () => {
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

  it('leaves out the heatmap without voice time, and says so when it was the only part', () => {
    const svg = statsCard(data({ ...sections(), sections: ['heatmap'], heatmap: [], summary: summary({ sessions: 0, voiceMs: 0 }) }), THEMES.dark);
    expect(svg).not.toContain('in voice<');
    expect(svg.match(/rx="2"/g)).toBeNull();
    expect(svg).toContain('Nothing to show in these parts');
  });

  it('shows the calendar even when the period is empty', () => {
    const svg = statsCard(
      data({ ...sections(), sections: ['calendar', 'totals'], summary: summary({ sessions: 0, messages: 0, companions: [] }) }),
      THEMES.dark
    );
    expect(svg).toContain('Past year');
    expect(svg).not.toContain('Sessions');
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
