import type { MemberProfile } from '../stats/queries';
import { profileCard, ProfileCardData } from './profile.card';
import { renderPng } from './render';
import { THEMES } from './themes';

const H = 60 * 60 * 1000;

const profile = (overrides: Partial<MemberProfile> = {}): MemberProfile => ({
  trackingSince: new Date('2026-07-11T13:27:02Z'),
  sessions: 84,
  voiceMs: 100 * H,
  longestSessionMs: 6 * H,
  mutedMs: 25 * H,
  streamingMs: 10 * H,
  lastWeekMs: 12 * H,
  favouriteChannelId: 'vc1',
  rps: { wins: 3, ties: 1, losses: 1 },
  ...overrides,
});

const data = (overrides: Partial<ProfileCardData> = {}): ProfileCardData => ({
  profile: profile(),
  memberName: '<b>Astolfo</b>',
  serverName: 'Paladins',
  favouriteChannelName: 'general & chill',
  now: new Date('2026-07-11T13:27:02Z'.replace('07-11', '11-08')), // 120 days later
  ...overrides,
});

describe('profileCard', () => {
  it('shows the all-time numbers', () => {
    const svg = profileCard(data(), THEMES.dark);
    expect(svg).toContain('tracking since 11 July 2026');
    expect(svg).toContain('>4d 4h<'); // 100h
    expect(svg).toContain('3.5% of tracked time'); // 100h of 2880h
    expect(svg).toContain('most in #general &amp; chill');
    expect(svg).toContain('>25.0%<'); // muted
    expect(svg).toContain('>10.0%<'); // streaming
    expect(svg).toContain('3 wins · 1 tie · 1 loss');
  });

  it('escapes the member name', () => {
    const svg = profileCard(data(), THEMES.dark);
    expect(svg).toContain('&lt;b&gt;Astolfo&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('copes with no games and no favourite channel', () => {
    const svg = profileCard(
      data({ profile: profile({ rps: { wins: 0, ties: 0, losses: 0 }, favouriteChannelId: undefined }), favouriteChannelName: undefined }),
      THEMES.light
    );
    expect(svg).toContain('No games yet');
    expect(svg).not.toContain('clip-path="url(#rps)"');
    expect(svg).not.toContain('most in #');
  });

  it('renders to a PNG', async () => {
    const png = await renderPng(profileCard(data(), THEMES.stolfo));
    expect(png.length).toBeGreaterThan(1000);
  });
});
