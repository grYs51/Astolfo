import type { ServerDigest } from '../stats/queries';
import { digestCard, DigestCardData } from './digest.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const H = 60 * 60 * 1000;

const digest = (overrides: Partial<ServerDigest> = {}): ServerDigest => ({
  voiceMs: 12 * H,
  previousVoiceMs: 2 * H,
  messages: 17,
  previousMessages: 10,
  activeMembers: 4,
  topVoice: [{ memberId: '100', ms: 4 * H }],
  topMessages: [{ memberId: '100', count: 5 }],
  bestDuo: { a: '100', b: '200', togetherMs: 2 * H },
  busiestDay: { day: new Date('2026-09-29T00:00:00Z'), ms: 10 * H },
  topStreaks: [{ memberId: '100', days: 5 }],
  milestones: [{ memberId: '200', hours: 100 }],
  ...overrides,
});

const data = (overrides: Partial<DigestCardData> = {}): DigestCardData => ({
  digest: digest(),
  serverName: 'Paladins',
  weekStart: new Date('2026-09-28T00:00:00Z'),
  members: { '100': { name: 'Astolfo' }, '200': { name: '<b>Roland</b>' } },
  ...overrides,
});

describe('digestCard', () => {
  it('shows the week, totals, leaders, streaks, milestones, duo and busiest day', () => {
    const svg = digestCard(data(), THEMES.dark);
    expect(svg).toContain('Last week in Paladins');
    expect(svg).toContain('28 September – 4 October (UTC)');
    expect(svg).toContain('↑ 500% vs the week before');
    for (const label of ['Most time in voice', 'Most messages', 'Longest voice streaks', 'Milestones reached', 'Duo of the week']) {
      expect(svg).toContain(label);
    }
    expect(svg).toContain('>5 days<');
    expect(svg).toContain('>passed 100h<');
    expect(svg).toContain('Astolfo &amp; &lt;b&gt;Roland&lt;/b&gt;');
    expect(svg).toContain('Busiest day: Tuesday · 10h in voice');
  });

  it('escapes names and falls back for members it has no name for', () => {
    const svg = digestCard(data({ members: { '200': { name: '<b>Roland</b>' } } }), THEMES.dark);
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('Unknown member');
  });

  it('leaves out sections with nothing to show', () => {
    const quiet = digest({ topVoice: [], bestDuo: undefined, busiestDay: undefined, voiceMs: 0, previousVoiceMs: 0, topStreaks: [], milestones: [] });
    const svg = digestCard(data({ digest: quiet }), THEMES.light);
    expect(svg).toContain('Most messages');
    for (const label of ['Most time in voice', 'Longest voice streaks', 'Milestones reached', 'Duo of the week', 'Busiest day']) {
      expect(svg).not.toContain(label);
    }
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(digestCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
