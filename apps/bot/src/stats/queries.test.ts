import { Prisma } from '@prisma/client';
import { getDuo, getMemberSummary, getMemberWrapped, personaFor, WRAPPED_XP_GROUPS, yearWindow } from './queries';
import { DEFAULT_RULES, levelFor } from '../xp/rules';

// No test database in this repo: the SQL was checked once against the dev database
// (overlap in one channel, no overlap in another, an open session, MUTED rows ignored).
// These tests pin the query's rules and the mapping.

/** A db whose raw queries return `results` in call order: the pair, then a's and b's voice totals */
const dbWith = (results: unknown[][]) => {
  const queryRaw = jest.fn();
  results.forEach((rows) => queryRaw.mockResolvedValueOnce(rows));
  return queryRaw;
};

const now = new Date('2026-11-09T12:00:00Z');

describe('getDuo', () => {
  test('time together, both voice totals and the top channel', async () => {
    const queryRaw = dbWith([
      [{ channel_id: 'vc1', total: BigInt(3 * 3_600_000) }],
      [{ total: BigInt(8 * 3_600_000), sessions: BigInt(3) }],
      [{ total: BigInt(6 * 3_600_000), sessions: BigInt(4) }],
    ]);
    const duo = await getDuo({ $queryRaw: queryRaw } as never, 'g', 'a', 'b', 'week', now);
    expect(duo).toEqual({ togetherMs: 3 * 3_600_000, aVoiceMs: 8 * 3_600_000, bVoiceMs: 6 * 3_600_000, topChannelId: 'vc1' });

    const [strings, ...values] = queryRaw.mock.calls[0];
    const pair = Prisma.sql(strings, ...values);
    // VOICE rows only, for this pair, open sessions counted until now
    expect(pair.values.filter((v) => v === 'VOICE')).toHaveLength(2);
    expect(pair.values).toEqual(expect.arrayContaining(['g', 'a', 'b']));
    // Both sessions must start in the window, so a's and b's cards agree
    const from = new Date(now.getTime() - 7 * 24 * 3_600_000).getTime();
    expect(pair.values.filter((v) => v instanceof Date && v.getTime() === from)).toHaveLength(2);
    expect(pair.sql).toMatch(/COALESCE\(a\.ended_on, NOW\(\)\)/);
    expect(pair.sql).toMatch(/COALESCE\(b\.ended_on, NOW\(\)\)/);
  });

  test('no time together: zero and no channel', async () => {
    const queryRaw = dbWith([[], [{ total: BigInt(0), sessions: BigInt(0) }], [{ total: BigInt(60_000), sessions: BigInt(1) }]]);
    const duo = await getDuo({ $queryRaw: queryRaw } as never, 'g', 'a', 'b', 'all', now);
    expect(duo).toEqual({ togetherMs: 0, aVoiceMs: 0, bVoiceMs: 60_000, topChannelId: undefined });
  });
});

describe('getMemberSummary', () => {
  const queryRaw = jest.fn<Promise<object[]>, unknown[]>();
  const db = { $queryRaw: queryRaw } as never;

  test('message rank counts messages in the period', async () => {
    queryRaw.mockResolvedValue([{ total: 0n, sessions: 0n, count: 0n, members: 5n, rank: 2n }]);
    const summary = await getMemberSummary(db, 'g', 'member', 'month');
    expect(summary).toMatchObject({ messageRank: 2 });
    const messageRank = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings as TemplateStringsArray, ...values))
      .find((q) => /FROM message_stats/.test(q.sql) && /WITH totals/.test(q.sql));
    expect(messageRank?.sql).toMatch(/COUNT\(\*\) AS total/);
    expect(messageRank?.sql).toMatch(/created_at >= /);
  });
});

describe('personaFor', () => {
  test.each([
    [23, 'Night owl'],
    [3, 'Night owl'],
    [7, 'Early bird'],
    [14, 'Afternoon regular'],
    [20, 'Evening regular'],
  ])('%i:00 → %s', (hour, label) => expect(personaFor(hour)).toBe(label));
});

describe('getMemberWrapped', () => {
  const H = 3_600_000;
  const now = new Date('2026-11-22T12:00:00Z');
  type Part =
    | 'totals' | 'channels' | 'buddies' | 'months' | 'hours' | 'calendar'
    | 'streak' | 'lifetime' | 'rank' | 'xp' | 'games' | 'xpRank' | 'bestDay';

  /** Which query this is, by what it reads, so the order of the Promise.all doesn't matter */
  const partOf = (sql: string): Part =>
    /generate_series\(1, 12\)/.test(sql) ? 'months'
    : /WITH totals/.test(sql) ? (/FROM xp_events/.test(sql) ? 'xpRank' : 'rank')
    : /created_at::date/.test(sql) ? 'bestDay'
    : /FROM xp_events/.test(sql) ? 'xp'
    : /FROM game_player/.test(sql) ? 'games'
    : /generate_series\(0, 23\)/.test(sql) ? 'hours'
    : /INTERVAL '1 day'/.test(sql) ? 'calendar'
    : /WITH days/.test(sql) ? 'streak'
    : /AS before/.test(sql) ? 'lifetime'
    : /voice_stats other/.test(sql) ? 'buddies'
    : /GROUP BY channel_id/.test(sql) ? 'channels'
    : 'totals';

  const dbFor = (rows: Partial<Record<Part, object[]>>) => {
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
      Promise.resolve(rows[partOf(Prisma.sql(strings, ...values).sql)] ?? [])
    );
    return { db: { $queryRaw: queryRaw } as never, queryRaw };
  };

  const MONTH_HOURS = [18, 22, 15, 20, 26, 31, 35, 28, 24, 30, 49, 14];
  const months = MONTH_HOURS.map((hours, i) => ({ month: i + 1, voice: BigInt(hours * H), messages: 1070n, xp: 1000 + i }));
  // Busiest at 21:00
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, minutes: hour === 21 ? 900 : hour >= 18 ? 400 : 10 }));

  test('yearWindow is the UTC calendar year, cut at now for the current one', () => {
    expect(yearWindow(2025, now)).toEqual({ from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(yearWindow(2026, now)).toEqual({ from: new Date('2026-01-01T00:00:00Z'), to: now });
  });

  test('maps the year', async () => {
    const { db } = dbFor({
      totals: [{ total: BigInt(312 * H), sessions: 406n, longest: BigInt(9 * H) }],
      channels: [{ channel_id: 'vc1', total: BigInt(190 * H) }, { channel_id: 'vc2', total: BigInt(84 * H) }],
      buddies: [{ member_id: 'b', together: BigInt(81 * H) }, { member_id: 'c', together: BigInt(40 * H) }],
      months,
      hours,
      calendar: [{ day: new Date('2026-03-04T00:00:00Z'), minutes: 90, messages: 2 }],
      streak: [{ member_id: 'me', current: 3, longest: 23 }],
      // 40h before the year, 352h at its end: passes 50, 100 and 250
      lifetime: [{ before: BigInt(40 * H), after: BigInt(352 * H) }],
      rank: [{ members: 57n, rank: 2n }],
      xp: [{ before: 500, gained: 14_200, weekly: 6, voice: 8_520, messages: 2_840, games: 1_420, streaks: 1_420, bonuses: 0 }],
      games: [{ rps: 3n, ttt: 1n, trivia: 12n }],
      xpRank: [{ members: 41n, rank: 3n }],
      bestDay: [{ day: new Date('2026-11-07T00:00:00Z'), total: 1240 }],
    });
    const wrapped = await getMemberWrapped(db, 'g', 'me', 2026, now);
    expect(wrapped).toEqual({
      year: 2026,
      voiceMs: 312 * H,
      sessions: 406,
      longestSessionMs: 9 * H,
      topChannels: [{ channelId: 'vc1', voiceMs: 190 * H }, { channelId: 'vc2', voiceMs: 84 * H }],
      buddies: [{ memberId: 'b', togetherMs: 81 * H }, { memberId: 'c', togetherMs: 40 * H }],
      months: MONTH_HOURS.map((h, i) => ({ month: i + 1, voiceMs: h * H, messages: 1070, xp: 1000 + i })),
      peakMonth: { month: 11, voiceMs: 49 * H, messages: 1070, xp: 1010 },
      hours: hours.map((h) => h.minutes),
      persona: { label: 'Evening regular', peakHour: 21 },
      days: { start: '2026-01-01', end: '2026-11-22', days: [{ date: '2026-03-04', minutes: 90, messages: 2 }] },
      longestStreak: 23,
      milestones: [50, 100, 250],
      messages: 12 * 1070,
      voiceRank: { rank: 2, members: 57, topPercent: 4 },
      xp: {
        gained: 14_200,
        levelFrom: levelFor(500, DEFAULT_RULES),
        levelTo: levelFor(14_700, DEFAULT_RULES),
        levelUps: levelFor(14_700, DEFAULT_RULES) - levelFor(500, DEFAULT_RULES),
        rank: { rank: 3, members: 41, topPercent: 8 },
        sources: [
          { group: 'voice', xp: 8_520, share: 0.6 },
          { group: 'messages', xp: 2_840, share: 0.2 },
          { group: 'games', xp: 1_420, share: 0.1 },
          { group: 'streaks', xp: 1_420, share: 0.1 },
          { group: 'bonuses', xp: 0, share: 0 },
        ],
        bestDay: { date: '2026-11-07', xp: 1240 },
        weeklyTop3: 6,
      },
      games: { rockPaperScissors: 3, ticTacToe: 1, trivia: 12 },
    });
  });

  test('XP groups every source once, and its queries read the year', async () => {
    const all = Object.values(WRAPPED_XP_GROUPS).flat().sort();
    expect(all).toEqual(['GAME', 'MESSAGE', 'MILESTONE', 'RECONNECT', 'STARTER', 'STREAK', 'TRIVIA', 'VOICE', 'WEEKLY', 'WELCOME']);
    const { db, queryRaw } = dbFor({ totals: [{ total: 0n, sessions: 0n, longest: 0n }] });
    await getMemberWrapped(db, 'g', 'me', 2025, now);
    const from = new Date('2025-01-01T00:00:00Z').getTime();
    const xp = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings, ...values))
      .filter((q) => /FROM xp_events/.test(q.sql));
    expect(xp.map((q) => partOf(q.sql)).sort()).toEqual(['bestDay', 'months', 'xp', 'xpRank']);
    for (const q of xp) expect(q.values.some((v) => v instanceof Date && v.getTime() === from)).toBe(true);
  });

  test('a quiet year: no rank, peak, persona, buddies or streak', async () => {
    const { db } = dbFor({
      totals: [{ total: 0n, sessions: 0n, longest: 0n }],
      months: months.map((m) => ({ ...m, voice: 0n, messages: m.month === 2 ? 3n : 0n })),
      hours: hours.map((h) => ({ ...h, minutes: 0 })),
      xp: [{ before: 0, gained: 0 }],
    });
    expect(await getMemberWrapped(db, 'g', 'me', 2025, now)).toMatchObject({
      voiceMs: 0,
      topChannels: [],
      buddies: [],
      peakMonth: null,
      persona: null,
      days: { start: '2025-01-01', end: '2025-12-31', days: [] },
      longestStreak: 0,
      milestones: [],
      messages: 3,
      voiceRank: null,
      xp: { gained: 0, levelFrom: 0, levelTo: 0, levelUps: 0, rank: null, bestDay: null, weeklyTop3: 0 },
      games: { rockPaperScissors: 0, ticTacToe: 0, trivia: 0 },
    });
  });

  test('every voice query reads VOICE rows that started in the year, open sessions live', async () => {
    const { db, queryRaw } = dbFor({ totals: [{ total: 0n, sessions: 0n, longest: 0n }] });
    await getMemberWrapped(db, 'g', 'me', 2025, now);
    const from = new Date('2025-01-01T00:00:00Z').getTime();
    const to = new Date('2026-01-01T00:00:00Z').getTime();
    const voice = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings, ...values))
      .filter((q) => /FROM voice_stats/.test(q.sql));
    expect(voice.map((q) => partOf(q.sql)).sort()).toEqual(
      ['buddies', 'calendar', 'channels', 'hours', 'lifetime', 'months', 'rank', 'streak', 'totals'].sort()
    );
    for (const q of voice) {
      expect(q.values).toContain('VOICE');
      expect(q.sql).toMatch(/COALESCE\((\w+\.)?ended_on, (NOW\(\)|\(NOW\(\) AT TIME ZONE 'UTC'\))\)/);
      expect(q.values.some((v) => v instanceof Date && v.getTime() === to)).toBe(true);
      // The lifetime query also reads before the year, for the milestones; the calendar starts at its first day
      if (partOf(q.sql) === 'calendar') expect(q.values).toContain('2025-01-01');
      else if (partOf(q.sql) !== 'lifetime') expect(q.values.some((v) => v instanceof Date && v.getTime() === from)).toBe(true);
    }
  });

  test('games count wins in the server in the year, without the games against Astolfo', async () => {
    const { db, queryRaw } = dbFor({ totals: [{ total: 0n, sessions: 0n, longest: 0n }] });
    await getMemberWrapped(db, 'g', 'me', 2025, now);
    const games = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings, ...values))
      .find((q) => partOf(q.sql) === 'games');
    expect(games?.values).toEqual(expect.arrayContaining(['rock-paper-scissors', 'tic-tac-toe', 'trivia', 'me', 'g', 1]));
    expect(games?.values).not.toContain('rock-paper-scissors-astolfo');
  });
});
