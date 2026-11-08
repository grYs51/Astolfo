import type { MemberSummary } from '../stats/queries';
import { renderPng } from './render';
import { statsCard, StatsCardData } from './stats.card';
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
  favouriteChannelId: 'vc1',
  companions: [
    { memberId: '200', togetherMs: 2 * H },
    { memberId: '300', togetherMs: H },
  ],
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

describe('statsCard', () => {
  it('shows voice, messages, rank and sessions with the change', () => {
    const svg = statsCard(data(), THEMES.dark);
    expect(svg).toContain('>4h<');
    expect(svg).toContain('↑ 100% vs the week before');
    expect(svg).toContain('>1,234<');
    expect(svg).toContain('↓ 38% vs the week before');
    expect(svg).toContain('>#1<');
    expect(svg).toContain('of 3 members');
    expect(svg).toContain('most in #general &amp; chill');
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

  it('renders to a PNG', async () => {
    const png = await renderPng(statsCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
