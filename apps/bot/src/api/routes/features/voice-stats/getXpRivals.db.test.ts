import { PrismaClient } from '@prisma/client';
import { xpRivals } from './getXpRivals';

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied (see grant.db.test.ts)
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'xp-rivals-guild';
const ME = 'me';

describeDb('xpRivals', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);
  // me 1,000; m00…m24 at 1,000 + (i − 12) × 10, so m12 ties with me and m11/m13 are 10 away
  const others = Array.from({ length: 25 }, (_, i) => [`m${String(i).padStart(2, '0')}`, 1000 + (i - 12) * 10] as const);
  const totals: (readonly [string, number])[] = [[ME, 1000], ...others, ['left', 1000], ['zero', 0]];
  const current = [ME, 'zero', ...others.map(([id]) => id)];

  beforeAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    await db.xp_events.createMany({
      data: totals.map(([member_id, amount]) => ({
        guild_id: G,
        member_id,
        source: 'MESSAGE',
        amount,
        note: 'test',
        key: `xp-rivals:${member_id}`,
        created_at: new Date(Date.UTC(2026, 0, 5)),
      })),
    });
    // Other servers' XP doesn't count
    await db.xp_events.create({
      data: { guild_id: 'xp-rivals-other', member_id: 'm00', source: 'MESSAGE', amount: 5000, note: 'test', key: 'xp-rivals:other', created_at: new Date() },
    });
  });

  afterAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: { in: [G, 'xp-rivals-other'] } } });
    await db.$disconnect();
  });

  test('the 20 closest current members by XP, ties by id, never the member, those who left or those without XP', async () => {
    const rows = await xpRivals(db, { serverId: G, userId: ME, memberIds: current });
    expect(rows).toHaveLength(20);
    expect(rows.slice(0, 5)).toEqual([
      { member_id: 'm12', xp: 1000, difference: 0 },
      { member_id: 'm11', xp: 990, difference: -10 },
      { member_id: 'm13', xp: 1010, difference: 10 },
      { member_id: 'm10', xp: 980, difference: -20 },
      { member_id: 'm14', xp: 1020, difference: 20 },
    ]);
    // m02 and m22 are both 100 away: the 20th place goes to m02 by id
    expect(rows[19]).toEqual({ member_id: 'm02', xp: 900, difference: -100 });
    expect(rows.some((r) => [ME, 'left', 'zero'].includes(r.member_id))).toBe(false);
  });

  test('a member without XP gets the members with the least XP first', async () => {
    const rows = await xpRivals(db, { serverId: G, userId: 'newcomer', memberIds: current });
    expect(rows.slice(0, 2).map((r) => [r.member_id, r.difference])).toEqual([['m00', 880], ['m01', 890]]);
  });
});
