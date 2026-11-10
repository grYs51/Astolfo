import { Prisma } from '@prisma/client';
import { getDuo, getMemberSummary } from './queries';

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

describe('getMemberSummary privacy', () => {
  const queryRaw = jest.fn<Promise<object[]>, unknown[]>(async () => [{ total: 0n, sessions: 0n, count: 0n }]);
  const db = { $queryRaw: queryRaw } as never;

  /** For each query, the viewer its privacy filter lets through (`user_id <> viewer`) */
  const viewersSeen = () =>
    queryRaw.mock.calls.flatMap(([strings, ...values]) => {
      const sql = Prisma.sql(strings as TemplateStringsArray, ...values);
      return sql.strings.flatMap((s, i) => (/user_id <> $/.test(s) ? [sql.values[i]] : []));
    });

  beforeEach(() => queryRaw.mockClear());

  // voice rank, message rank, companions and the streak each filter hidden members
  test('/stats: every filter lets the member through (they always see themselves)', async () => {
    await getMemberSummary(db, 'g', 'member', 'month');
    expect(viewersSeen()).toEqual(['member', 'member', 'member', 'member']);
  });

  test('another viewer: ranks and companions leave out members hidden from the viewer', async () => {
    await getMemberSummary(db, 'g', 'member', 'month', 'viewer');
    // the streak is the member's own, so it stays theirs
    expect(viewersSeen().sort()).toEqual(['member', 'viewer', 'viewer', 'viewer']);
  });

  test('message rank counts messages in the period', async () => {
    queryRaw.mockResolvedValue([{ total: 0n, sessions: 0n, count: 0n, members: 5n, rank: 2n }]);
    const summary = await getMemberSummary(db, 'g', 'member', 'month', 'viewer');
    queryRaw.mockImplementation(async () => [{ total: 0n, sessions: 0n, count: 0n }]);
    expect(summary).toMatchObject({ voiceRank: 2, messageRank: 2, rankedMembers: 5 });
    const messageRank = queryRaw.mock.calls
      .map(([strings, ...values]) => Prisma.sql(strings as TemplateStringsArray, ...values))
      .find((q) => /FROM message_stats/.test(q.sql) && /WITH totals/.test(q.sql));
    expect(messageRank?.sql).toMatch(/COUNT\(\*\) AS total/);
    expect(messageRank?.sql).toMatch(/created_at >= /);
  });
});
