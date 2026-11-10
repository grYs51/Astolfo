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

  test('wins against another member, more for a streak; a win against Astolfo earns nothing', async () => {
    // The game against Astolfo between them doesn't break the streak either
    expect((await rows('GAME')).map((r) => [r.member_id, r.amount, r.note])).toEqual([
      ['xp-a', 5, 'Won rock-paper-scissors'],
      ['xp-a', 7, 'Won rock-paper-scissors (2 in a row)'],
      ['xp-a', 9, 'Won rock-paper-scissors (3 in a row)'],
    ]);
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
