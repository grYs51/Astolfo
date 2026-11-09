import {
  buildDigestMessage,
  dashboardUrlFor,
  formatChange,
  formatDuration,
} from './messages';
import type { APIEmbed } from 'discord.js';
import type { ServerDigest } from './queries';

const H = 60 * 60 * 1000;
const URL = 'https://astolfo.example/overview/detail/guild';

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

const embedOf = (message: { embeds?: readonly unknown[] }) =>
  (message.embeds?.[0] as { toJSON: () => APIEmbed }).toJSON();

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

describe('buildDigestMessage', () => {
  const weekStart = new Date('2026-09-28T00:00:00Z');

  test('totals, leaders, duo and busiest day for the week', () => {
    const message = buildDigestMessage({ digest: digest(), guildName: 'Test', dashboardUrl: URL, weekStart });
    const embed = embedOf(message);

    expect(embed.title).toBe('Last week in Test');
    expect(embed.footer?.text).toContain('28 September – 4 October (UTC)');
    expect(embed.fields?.map((f) => f.name)).toEqual([
      'Most time in voice',
      'Most messages',
      'Duo of the week',
      'Longest voice streaks',
      'Milestones',
      'Busiest day',
    ]);
    expect(embed.fields?.[3].value).toBe('🥇 <@100> · 🔥 5 days');
    expect(embed.fields?.[4].value).toBe('<@200> passed **100h** in voice');
    expect(embed.fields?.[5].value).toBe('Tuesday · 10h in voice');
    // Nobody gets pinged by the weekly post
    expect(message.allowedMentions).toEqual({ parse: [] });
  });

  test('leaves out sections with nothing to show', () => {
    const quiet = digest({ topVoice: [], bestDuo: undefined, busiestDay: undefined, voiceMs: 0, previousVoiceMs: 0, topStreaks: [], milestones: [] });
    const embed = embedOf(buildDigestMessage({ digest: quiet, guildName: 'Test', dashboardUrl: URL, weekStart }));
    expect(embed.fields?.map((f) => f.name)).toEqual(['Most messages']);
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

  test('left out when CLIENT_URL is missing or not absolute', () => {
    delete process.env.CLIENT_URL;
    expect(dashboardUrlFor('g')).toBeUndefined();
    process.env.CLIENT_URL = 'astolfo.example';
    expect(dashboardUrlFor('g')).toBeUndefined();
  });

  test('messages still build without a link (no button, no title URL)', () => {
    const recap = buildDigestMessage({ digest: digest(), guildName: 'Test', weekStart: new Date('2026-09-28T00:00:00Z') });
    expect(embedOf(recap).url).toBeUndefined();
    expect(recap.components).toEqual([]);
  });
});
