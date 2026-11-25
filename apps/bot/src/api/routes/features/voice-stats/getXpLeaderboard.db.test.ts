import { PrismaClient } from '@prisma/client';
import { xpRanks } from './getXpLeaderboard';

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied (see grant.db.test.ts)
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'xp-ranks-guild';
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describeDb('xpRanks', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);

  beforeAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    const rows: [string, number, Date][] = [
      // a led 7 days ago, b passed them this week, c is new, left had the most but left the server
      ['a', 100, daysAgo(10)],
      ['b', 50, daysAgo(10)],
      ['b', 80, daysAgo(2)],
      ['c', 10, daysAgo(1)],
      ['left', 999, daysAgo(10)],
      ['zero', 0, daysAgo(10)],
    ];
    await db.xp_events.createMany({
      data: rows.map(([member_id, amount, created_at], i) => ({
        guild_id: G,
        member_id,
        source: 'MESSAGE',
        amount,
        note: 'test',
        key: `xp-ranks:${i}`,
        created_at,
      })),
    });
  });

  afterAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    await db.$disconnect();
  });

  test('current members with XP, ranked now and 7 days ago', async () => {
    expect(await xpRanks(db, G, ['a', 'b', 'c', 'zero'])).toEqual([
      { member_id: 'b', xp: 130, week_xp: 80, rank: 1, rank_before: 2 },
      { member_id: 'a', xp: 100, week_xp: 0, rank: 2, rank_before: 1 },
      { member_id: 'c', xp: 10, week_xp: 10, rank: 3, rank_before: null },
    ]);
  });
});
