import { PrismaClient } from '@prisma/client';
import { grantXp } from './grant';
import { DEFAULT_RULES, setRules } from './rules';
import { recalculateXp } from './recalculate';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';

jest.mock('../client/instance', () => ({ client: {} }));
jest.mock('../api/utils/discord-directory', () => ({ discordDirectory: () => ({ channel: () => undefined }) }));

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied
// (CI starts one; locally a throwaway database). It works in its own guild id and deletes its rows before
// and after.
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'xp-test-guild';
const D0 = Date.UTC(2026, 0, 5); // a Monday
const at = (day: number, hour: number, min = 0, sec = 0) => new Date(D0 + day * 86_400_000 + hour * 3_600_000 + min * 60_000 + sec * 1000);
const isBot = (id: string) => id === 'xp-bot';
const NOW = at(60, 0);

describeDb('grantXp on seeded rows', () => {
  // Built only when the suite runs: a PrismaClient without a URL throws
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);
  const grant = (opts: Partial<Parameters<typeof grantXp>[1]> = {}) =>
    grantXp(db as never, { guildId: G, rules: DEFAULT_RULES, isBot, now: NOW, ...opts });
  const rows = (source: string) =>
    db.xp_events.findMany({ where: { guild_id: G, source }, orderBy: [{ created_at: 'asc' }, { member_id: 'asc' }] });

  const voice = (member: string, channel: string, from: Date, to: Date) => ({
    guild_id: G,
    member_id: member,
    channel_id: channel,
    type: 'VOICE',
    issued_on: from,
    ended_on: to,
  });

  const clean = async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    await db.voice_stats.deleteMany({ where: { guild_id: G } });
    await db.message_stats.deleteMany({ where: { guild_id: G } });
    await db.game_player.deleteMany({ where: { game_result: { guild_id: G } } });
    await db.game_result.deleteMany({ where: { guild_id: G } });
  };

  beforeAll(async () => {
    await clean();
    for (const id of Object.values(GAME_TYPES)) {
      await db.game_type.upsert({ where: { id }, update: {}, create: { id, name: id } });
    }
    await db.voice_stats.createMany({
      data: [
        // A and C, then again 31 days later: a reconnect
        voice('xp-a', 'ch1', at(0, 10), at(0, 11)),
        voice('xp-c', 'ch1', at(0, 10), at(0, 11)),
        voice('xp-a', 'ch1', at(31, 10), at(31, 11)),
        voice('xp-c', 'ch1', at(31, 10), at(31, 11)),
        // A and D, then again 29 days later: not yet
        voice('xp-a', 'ch2', at(0, 12), at(0, 13)),
        voice('xp-d', 'ch2', at(0, 12), at(0, 13)),
        voice('xp-a', 'ch2', at(29, 12), at(29, 13)),
        voice('xp-d', 'ch2', at(29, 12), at(29, 13)),
        // A with only a music bot: alone
        voice('xp-a', 'ch4', at(0, 14), at(0, 15)),
        voice('xp-bot', 'ch4', at(0, 14), at(0, 15)),
        // F: 11 hours in one go
        voice('xp-f', 'ch5', at(2, 0), at(2, 11)),
        // E (here since day 1) starts a call 40 days in; N's first session ever joins it
        voice('xp-e', 'ch6', at(1, 20), at(1, 20, 5)),
        voice('xp-e', 'ch3', at(40, 10), at(40, 10, 30)),
        voice('xp-n', 'ch3', at(40, 10, 5), at(40, 10, 30)),
      ],
    });
    await db.message_stats.createMany({
      data: [at(0, 10, 0, 5), at(0, 10, 0, 40), at(0, 10, 1, 10)].map((created_at, i) => ({
        guild_id: G,
        channel_id: 'text',
        user_id: 'xp-a',
        message_id: `m${i}`,
        created_at,
      })),
    });
    const game = (winner: string, loser: string | undefined, minute: number, type = GAME_TYPES.ROCK_PAPER_SCISSORS) =>
      db.game_result.create({
        data: {
          guild_id: G,
          game_type_id: type,
          created_at: at(1, 9, minute),
          players: {
            create: [
              { user_id: winner, result: SCORING.WIN },
              ...(loser ? [{ user_id: loser, result: SCORING.LOSS }] : []),
            ],
          },
        },
      });
    await game('xp-a', 'xp-c', 1);
    await game('xp-a', 'xp-c', 2);
    await game('xp-a', undefined, 3, GAME_TYPES.ROCK_PAPER_SCISSORS_ASTOLFO);
    await game('xp-a', 'xp-c', 4);
    await game('xp-a', undefined, 5, GAME_TYPES.TIC_TAC_TOE_ASTOLFO);
    await game('xp-a', 'xp-c', 6, GAME_TYPES.TIC_TAC_TOE);
    const trivia = (day: number, minute: number, difficulty: string, order: string[], wrong: string[] = []) =>
      db.game_result.create({
        data: {
          guild_id: G,
          game_type_id: GAME_TYPES.TRIVIA,
          created_at: at(day, 20, minute),
          metadata: { difficulty, correctOrder: order },
          players: {
            create: [
              ...order.map((user_id) => ({ user_id, result: SCORING.WIN })),
              ...wrong.map((user_id) => ({ user_id, result: SCORING.LOSS })),
            ],
          },
        },
      });
    await trivia(2, 0, 'hard', ['xp-t1', 'xp-t2'], ['xp-t3']);
    await trivia(2, 1, 'medium', ['xp-p1', 'xp-p2', 'xp-p3', 'xp-p4', 'xp-t2']);
    for (const minute of [10, 11, 12]) await trivia(3, minute, 'hard', ['xp-cap']);
    await trivia(4, 0, 'hard', ['xp-cap']);
  });

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  test('an amount of 0 writes no rows for that source', async () => {
    await grant({ memberId: 'xp-a', rules: { ...DEFAULT_RULES, amounts: { ...DEFAULT_RULES.amounts, message: 0 } } });
    expect(await rows('MESSAGE')).toHaveLength(0);
    await db.xp_events.deleteMany({ where: { guild_id: G } });
  });

  test('a whole-guild run, then a second that adds nothing', async () => {
    const first = await grant();
    expect(first.rows).toBeGreaterThan(0);
    expect(await grant()).toEqual({ rows: 0, xp: 0 });
  });

  test('the second message in a minute earns nothing', async () => {
    expect((await rows('MESSAGE')).map((r) => r.amount)).toEqual([2, 2]);
  });

  test('wins against another member, more for a streak across both games; a win against Astolfo earns nothing', async () => {
    // The games against Astolfo between them don't break the streak either
    expect((await rows('GAME')).map((r) => [r.member_id, r.amount, r.note])).toEqual([
      ['xp-a', 5, 'Won rock-paper-scissors'],
      ['xp-a', 7, 'Won rock-paper-scissors (2 in a row)'],
      ['xp-a', 9, 'Won rock-paper-scissors (3 in a row)'],
      ['xp-a', 11, 'Won tic-tac-toe (4 in a row)'],
    ]);
  });

  test('trivia: each place times the difficulty, rounded half up; a wrong answer earns nothing', async () => {
    const trivia = (await rows('TRIVIA')).filter((r) => r.member_id !== 'xp-cap');
    expect(trivia.map((r) => [r.member_id, r.amount, r.note])).toEqual([
      ['xp-t1', 30, 'Trivia: 1st (hard ×2)'],
      ['xp-t2', 20, 'Trivia: 2nd (hard ×2)'],
      ['xp-p1', 23, 'Trivia: 1st (medium ×1.5)'],
      ['xp-p2', 15, 'Trivia: 2nd (medium ×1.5)'],
      ['xp-p3', 11, 'Trivia: 3rd (medium ×1.5)'],
      ['xp-p4', 8, 'Trivia: 4th (medium ×1.5)'],
      ['xp-t2', 5, 'Trivia: 5th (medium ×1.5)'],
    ]);
  });

  test('the daily trivia cap cuts the grant that crosses it and skips the rest of that day', async () => {
    const capRows = async () =>
      (await rows('TRIVIA')).filter((r) => r.member_id === 'xp-cap').map((r) => [r.amount, r.note]);
    expect(await capRows()).toEqual([
      [30, 'Trivia: 1st (hard ×2)'],
      [30, 'Trivia: 1st (hard ×2)'],
      [30, 'Trivia: 1st (hard ×2)'],
      [30, 'Trivia: 1st (hard ×2)'],
    ]);
    await db.xp_events.deleteMany({ where: { guild_id: G, member_id: 'xp-cap' } });
    await grant({ memberId: 'xp-cap', rules: { ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, triviaDailyCap: 50 } } });
    expect(await capRows()).toEqual([
      [30, 'Trivia: 1st (hard ×2)'],
      [20, 'Trivia: 1st (hard ×2), daily cap reached'],
      // The next day starts again
      [30, 'Trivia: 1st (hard ×2)'],
    ]);
    // A live grant reads back only to the start of the day: the answer before `since` still counts towards the cap
    await db.xp_events.deleteMany({ where: { guild_id: G, member_id: 'xp-cap' } });
    await grant({
      memberId: 'xp-cap',
      since: at(3, 20, 11),
      rules: { ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds, triviaDailyCap: 50 } },
    });
    expect(await capRows()).toEqual([
      [20, 'Trivia: 1st (hard ×2), daily cap reached'],
      [30, 'Trivia: 1st (hard ×2)'],
    ]);
    // Put the default rows back for the tests after
    await db.xp_events.deleteMany({ where: { guild_id: G, member_id: 'xp-cap' } });
    await grant({ memberId: 'xp-cap' });
  });

  test('a music bot in the channel does not raise the crowd, and earns nothing', async () => {
    const [alone] = await db.xp_events.findMany({ where: { guild_id: G, source: 'VOICE', created_at: at(0, 15) } });
    expect(alone).toMatchObject({ member_id: 'xp-a', amount: 31 });
    expect(await db.xp_events.count({ where: { guild_id: G, member_id: 'xp-bot' } })).toBe(0);
  });

  test('a pair apart for 31 days reconnects, a pair apart for 29 days does not', async () => {
    expect((await rows('RECONNECT')).map((r) => [r.member_id, r.key])).toEqual([
      ['xp-a', `reconnect:${G}:xp-a:xp-c:2026-02-05`],
      ['xp-c', `reconnect:${G}:xp-c:xp-a:2026-02-05`],
    ]);
  });

  test("whoever is there for a newcomer's first session gets welcome, and starting it the starter bonus", async () => {
    expect((await rows('WELCOME')).map((r) => r.key)).toEqual([`welcome:${G}:xp-n:xp-e`]);
    expect((await rows('STARTER')).filter((r) => r.member_id === 'xp-e')).toHaveLength(1);
  });

  test('with voice XP off, a session is graded again but keeps its one starter bonus', async () => {
    const voiceOff = { ...DEFAULT_RULES, amounts: { ...DEFAULT_RULES.amounts, voiceMinute: 0 } };
    // No voice: rows, as when voice XP was off all along
    await db.xp_events.deleteMany({ where: { guild_id: G, member_id: 'xp-e', source: 'VOICE' } });
    await grant({ memberId: 'xp-e', rules: voiceOff });
    await grant({ memberId: 'xp-e', rules: voiceOff });
    expect((await rows('STARTER')).filter((r) => r.member_id === 'xp-e')).toHaveLength(1);
    // Put the voice rows back for the tests after
    await grant({ memberId: 'xp-e' });
  });

  test('crossing 10 hours grants the milestone once, dated when it was crossed', async () => {
    expect((await rows('MILESTONE')).map((r) => [r.member_id, r.amount, r.created_at])).toEqual([
      ['xp-f', 100, at(2, 10)],
    ]);
  });

  test("a finished week grants its top 3 once, ranked like the digest's top voice", async () => {
    // The music bot ties C and D at 1 h and takes #3 by id, as in the digest, but earns nothing
    expect((await rows('WEEKLY')).filter((r) => r.key.includes(':2026-01-05:')).map((r) => [r.member_id, r.amount])).toEqual([
      ['xp-a', 30],
      ['xp-f', 50],
    ]);
  });

  test('after a rule change, a recalculation gives the new amounts, and again the same total', async () => {
    const client = { dataSource: db, users: { cache: new Map([['xp-bot', { bot: true }]]) } } as never;
    const sumXp = async () => (await db.xp_events.aggregate({ where: { guild_id: G }, _sum: { amount: true } }))._sum.amount;
    setRules({ ...DEFAULT_RULES, amounts: { ...DEFAULT_RULES.amounts, message: 4 } });
    try {
      // Without a recalculation the old messages keep their amount
      expect((await rows('MESSAGE')).map((r) => r.amount)).toEqual([2, 2]);
      const before = await sumXp();
      const first = await recalculateXp(client, G);
      expect((await rows('MESSAGE')).map((r) => r.amount)).toEqual([4, 4]);
      expect(await sumXp()).toBe((before ?? 0) + 4);
      expect(first.xp).toBe(await sumXp());
      expect((await recalculateXp(client, G)).xp).toBe(first.xp);
    } finally {
      setRules(null);
    }
  });
});

describeDb('grantXp during a call (checkpoints)', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);
  const L = 'xp-live-guild';
  // With the live path's 2-day window, like awardAndAnnounce
  const checkpoint = (now: Date) =>
    grantXp(db as never, { guildId: L, memberId: 'xp-l1', since: new Date(now.getTime() - 2 * 86_400_000), rules: DEFAULT_RULES, isBot: () => false, now });
  const voiceRow = () => db.xp_events.findUniqueOrThrow({ where: { key: 'voice:live-open' } });
  const clean = async () => {
    await db.xp_events.deleteMany({ where: { guild_id: L } });
    await db.voice_stats.deleteMany({ where: { guild_id: L } });
  };
  const session = (id: string, member: string, from: Date, to: Date | null) => ({
    id,
    guild_id: L,
    member_id: member,
    channel_id: 'live',
    type: 'VOICE',
    issued_on: from,
    ended_on: to,
  });

  beforeAll(async () => {
    await clean();
    await db.voice_stats.createMany({
      data: [
        // 9 h 50 together 40 days before: 10 more minutes is a milestone, and back together is a reconnect
        session('live-old-1', 'xp-l1', at(30, 0), at(30, 9, 50)),
        session('live-old-2', 'xp-l2', at(30, 0), at(30, 9, 50)),
        // L1 starts a call at 10:00 and is still in it; L2 joins at 10:05
        session('live-open', 'xp-l1', at(70, 10), null),
        session('live-l2', 'xp-l2', at(70, 10, 5), at(70, 12)),
      ],
    });
  });

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  test('a checkpoint grades the open call up to now', async () => {
    // 5 min alone at 0.5× and 3 with one other: 5.5
    expect(await checkpoint(at(70, 10, 8))).toEqual({ rows: 1, xp: 5 });
    expect(await voiceRow()).toMatchObject({ amount: 5, created_at: at(70, 10, 8) });
    expect((await voiceRow()).note).toMatch(/^In #voice now, 8 min so far/);
  });

  test('the next checkpoint raises the same row and returns only the difference, with the bonuses the call has reached', async () => {
    // Voice 2.5 + 25 = 27 (+22), starter 15 (10 min together), milestone 100 (10 h at 10:10); no reconnect yet
    expect(await checkpoint(at(70, 10, 30))).toEqual({ rows: 3, xp: 137 });
    expect(await db.xp_events.count({ where: { guild_id: L, source: 'VOICE' } })).toBe(1);
    expect(await voiceRow()).toMatchObject({ amount: 27, created_at: at(70, 10, 30) });
    expect(await db.xp_events.findMany({ where: { guild_id: L, source: { in: ['STARTER', 'MILESTONE', 'RECONNECT'] } } })).toEqual([
      expect.objectContaining({ source: 'STARTER', amount: 15 }),
      expect.objectContaining({ source: 'MILESTONE', amount: 100, created_at: at(70, 10, 10) }),
    ]);
    expect(await checkpoint(at(70, 10, 30))).toEqual({ rows: 0, xp: 0 });
  });

  test('the close finishes the row at the end of the session and grants the reconnect, once', async () => {
    await db.voice_stats.update({ where: { id: 'live-open' }, data: { ended_on: at(70, 11) } });
    // 2.5 alone, 25 with L2, then 30 min at 1.1× for staying: 60 (+33), and the reconnect 25
    expect(await checkpoint(at(70, 12))).toEqual({ rows: 2, xp: 58 });
    const row = await voiceRow();
    expect(row).toMatchObject({ amount: 60, created_at: at(70, 11) });
    expect(row.note).toMatch(/^60 min in #voice/);
    expect(await db.xp_events.count({ where: { guild_id: L, source: 'RECONNECT' } })).toBe(1);
    expect(await checkpoint(at(70, 13))).toEqual({ rows: 0, xp: 0 });
  });

  test('a checkpoint that landed after the close is graded again, down to the final amount', async () => {
    await db.xp_events.update({ where: { key: 'voice:live-open' }, data: { amount: 62, created_at: at(70, 11, 2) } });
    expect(await checkpoint(at(70, 13))).toEqual({ rows: 1, xp: -2 });
    expect(await voiceRow()).toMatchObject({ amount: 60, created_at: at(70, 11) });
  });
});
