import { PrismaClient } from '@prisma/client';
import { xpHistoryPoints } from './getXpHistory';

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied (see grant.db.test.ts)
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'xp-history-guild';
const M = 'xp-history-member';
const D0 = Date.UTC(2026, 0, 5); // a Monday
const at = (day: number, hour: number) => new Date(D0 + day * 86_400_000 + hour * 3_600_000);

describeDb('xpHistoryPoints', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);
  const history = (opts: Partial<Parameters<typeof xpHistoryPoints>[1]> = {}) =>
    xpHistoryPoints(db, { serverId: G, userId: M, since: at(7, 12), now: at(10, 12), tz: 'UTC', granularity: 'day', ...opts });

  beforeAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    const rows: [string, number, Date][] = [
      ['old', 500, at(0, 10)],
      ['day7-late', 40, at(7, 23)],
      ['day9-a', 30, at(9, 1)],
      ['day9-b', 20, at(9, 22)],
      ['other-member', 999, at(9, 12)],
    ];
    await db.xp_events.createMany({
      data: rows.map(([key, amount, created_at]) => ({
        guild_id: G,
        member_id: key === 'other-member' ? 'someone-else' : M,
        source: 'MESSAGE',
        amount,
        note: key,
        key: `xp-history:${key}`,
        created_at,
      })),
    });
  });

  afterAll(async () => {
    await db.xp_events.deleteMany({ where: { guild_id: G } });
    await db.$disconnect();
  });

  test('every day from the start of the period to today, the running total starting at the real one', async () => {
    expect(await history()).toEqual({
      startXp: 500,
      points: [
        { date: '2026-01-12', gained: 40, total: 540 },
        { date: '2026-01-13', gained: 0, total: 540 },
        { date: '2026-01-14', gained: 50, total: 590 },
        { date: '2026-01-15', gained: 0, total: 590 },
      ],
    });
  });

  test("days are cut in the viewer's time zone", async () => {
    // 23:00 UTC on the 12th is the 13th in Brussels; 22:00 UTC on the 14th is 23:00 there, still the 14th
    const { points } = await history({ tz: 'Europe/Brussels' });
    expect(points.map((p) => [p.date, p.gained])).toEqual([
      ['2026-01-12', 0],
      ['2026-01-13', 40],
      ['2026-01-14', 50],
      ['2026-01-15', 0],
    ]);
  });

  test("weekly from the member's first XP when there's no period start", async () => {
    expect(await history({ since: undefined, granularity: 'week' })).toEqual({
      startXp: 0,
      points: [
        { date: '2026-01-05', gained: 500, total: 500 },
        { date: '2026-01-12', gained: 90, total: 590 },
      ],
    });
  });

  test('a flat line when nothing was earned in the period', async () => {
    const { startXp, points } = await history({ since: at(10, 0), now: at(11, 0) });
    expect(startXp).toBe(590);
    expect(points).toEqual([
      { date: '2026-01-15', gained: 0, total: 590 },
      { date: '2026-01-16', gained: 0, total: 590 },
    ]);
  });

  test('no XP at all: nothing for all time, zeros for a period', async () => {
    expect(await history({ userId: 'nobody', since: undefined })).toEqual({ startXp: 0, points: [] });
    expect((await history({ userId: 'nobody' })).points.every((p) => p.total === 0)).toBe(true);
  });
});
