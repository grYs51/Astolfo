import { Prisma } from '@prisma/client';
import { getDuo, getMemberSummary, getMemberWrapped, yearWindow } from './queries';
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

describe('getMemberWrapped', () => {
  const H = 3_600_000;
  const now = new Date('2026-11-22T12:00:00Z');
  type Part = 'totals' | 'channel' | 'duo' | 'peak' | 'streak' | 'lifetime' | 'messages' | 'rank' | 'xp';

  /** Answers each raw query by what it reads, so the order of the Promise.all doesn't matter */
  const dbFor = (rows: Partial<Record<Part, object[]>>) => {
    const queryRaw = jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const { sql } = Prisma.sql(strings, ...values);
      const pick: Part = /FROM xp_events/.test(sql)
        ? 'xp'
        : /WITH totals/.test(sql)
          ? 'rank'
          : /FROM message_stats/.test(sql)
            ? 'messages'
            : /WITH days/.test(sql)
              ? 'streak'
              : /AS before/.test(sql)
                ? 'lifetime'
                : /EXTRACT\(MONTH/.test(sql)
                  ? 'peak'
                  : /voice_stats other/.test(sql)
                    ? 'duo'
                    : /GROUP BY channel_id/.test(sql)
                      ? 'channel'
                      : 'totals';
      return Promise.resolve(rows[pick] ?? []);
    });
    return { db: { $queryRaw: queryRaw } as never, queryRaw };
  };

  test('yearWindow is the UTC calendar year, cut at now for the current one', () => {
    expect(yearWindow(2025, now)).toEqual({ from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(yearWindow(2026, now)).toEqual({ from: new Date('2026-01-01T00:00:00Z'), to: now });
  });

  test('maps the year', async () => {
    const { db } = dbFor({
      totals: [{ total: BigInt(312 * H), sessions: 406n, longest: BigInt(9 * H) }],
      channel: [{ channel_id: 'vc1' }],
      duo: [{ member_id: 'b', together: BigInt(81 * H) }],
      peak: [{ month: 11, total: BigInt(49 * H) }],
      streak: [{ member_id: 'me', current: 3, longest: 23 }],
      // 40h before the year, 352h at its end: passes 50, 100 and 250
      lifetime: [{ before: BigInt(40 * H), after: BigInt(352 * H) }],
      messages: [{ count: 12_840n }],
      rank: [{ members: 57n, rank: 2n }],
      xp: [{ before: 500, gained: 14_200 }],
    });
    const wrapped = await getMemberWrapped(db, 'g', 'me', 2026, now);
    expect(wrapped).toEqual({
      year: 2026,
      voiceMs: 312 * H,
      sessions: 406,
      longestSessionMs: 9 * H,
      favouriteChannelId: 'vc1',
      topDuo: { memberId: 'b', togetherMs: 81 * H },
      peakMonth: { month: 11, voiceMs: 49 * H },
      longestStreak: 23,
      milestones: [50, 100, 250],
      messages: 12_840,
      voiceRank: { rank: 2, members: 57, topPercent: 4 },
      xp: { gained: 14_200, levelFrom: levelFor(500, DEFAULT_RULES), levelTo: levelFor(14_700, DEFAULT_RULES) },
    });
  });

  test('a quiet year: no rank, month, duo or streak', async () => {
    const { db } = dbFor({ totals: [{ total: 0n, sessions: 0n, longest: 0n }], messages: [{ count: 3n }], xp: [{ before: 0, gained: 0 }] });
    expect(await getMemberWrapped(db, 'g', 'me', 2025, now)).toMatchObject({
      voiceMs: 0,
      favouriteChannelId: null,
      topDuo: null,
      peakMonth: null,
      longestStreak: 0,
      milestones: [],
      messages: 3,
      voiceRank: null,
      xp: { gained: 0, levelFrom: 0, levelTo: 0 },
    });
  });

  test('every voice query reads VOICE rows that started in the year, open sessions live', async () => {
    const { db, queryRaw } = dbFor({ totals: [{ total: 0n, sessions: 0n, longest: 0n }], messages: [{ count: 0n }] });
    await getMemberWrapped(db, 'g', 'me', 2025, now);
    const from = new Date('2025-01-01T00:00:00Z').getTime();
    const to = new Date('2026-01-01T00:00:00Z').getTime();
    const voice = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings, ...values))
      .filter((q) => /FROM voice_stats/.test(q.sql));
    expect(voice).toHaveLength(7); // totals, channel, duo, peak, streak, lifetime, rank
    for (const q of voice) {
      expect(q.values).toContain('VOICE');
      expect(q.sql).toMatch(/COALESCE\((\w+\.)?ended_on, NOW\(\)\)/);
      expect(q.values.some((v) => v instanceof Date && v.getTime() === to)).toBe(true);
      // The lifetime query also reads before the year, for the milestones
      if (!/AS before/.test(q.sql)) expect(q.values.some((v) => v instanceof Date && v.getTime() === from)).toBe(true);
    }
  });
});
