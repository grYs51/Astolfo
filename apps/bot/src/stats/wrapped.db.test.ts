import { PrismaClient } from '@prisma/client';
import { getMemberWrapped } from './queries';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';

jest.mock('../client/instance', () => ({ client: {} }));

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied, like
// xp/grant.db.test.ts. It works in its own guild id and deletes its rows before and after.
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'wrapped-test-guild';
const ME = 'w-me';
const FRIEND = 'w-friend';
const BOT = 'w-bot';
const now = new Date('2026-06-01T12:00:00Z');

describeDb('getMemberWrapped (database)', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);
  const session = (member_id: string, from: string, to: string) =>
    db.voice_stats.create({
      data: { guild_id: G, member_id, channel_id: 'vc1', type: VOICE_TYPE.VOICE, issued_on: new Date(from), ended_on: new Date(to) },
    });
  const clean = () => db.voice_stats.deleteMany({ where: { guild_id: G } });

  beforeAll(async () => {
    await clean();
    // 19:00–22:00 in New York (EST, before DST) is 00:00–03:00 UTC the next day
    await session(ME, '2025-02-10T00:00:00Z', '2025-02-10T03:00:00Z');
    // A music bot in the same channel all evening: the most time with ME and the most voice time overall
    await session(BOT, '2025-02-10T00:00:00Z', '2025-02-10T06:00:00Z');
    await session(FRIEND, '2025-02-10T01:00:00Z', '2025-02-10T02:00:00Z');
  });
  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  test('a bot with the most shared time is not a buddy and does not count in the voice rank', async () => {
    const withBots = await getMemberWrapped(db, G, ME, 2025, { now });
    // The data does make the bot the top duo and #1 when nothing leaves it out
    expect(withBots.buddies[0]).toEqual({ memberId: BOT, togetherMs: 3 * 3_600_000 });
    expect(withBots.voiceRank).toMatchObject({ rank: 2, members: 3 });

    const wrapped = await getMemberWrapped(db, G, ME, 2025, { now, botIds: [BOT] });
    expect(wrapped.buddies).toEqual([{ memberId: FRIEND, togetherMs: 3_600_000 }]);
    expect(wrapped.voiceRank).toMatchObject({ rank: 1, members: 2 });
  });

  test('the persona follows the time zone: evening in New York, night in UTC', async () => {
    const newYork = await getMemberWrapped(db, G, ME, 2025, { now, tz: 'America/New_York', botIds: [BOT] });
    expect(newYork.persona).toEqual({ label: 'Evening regular', peakHour: 19 });
    expect(newYork.months[1].voiceMs).toBe(3 * 3_600_000); // still February there
    expect(newYork.days.days).toEqual([{ date: '2025-02-09', minutes: 180, messages: 0 }]);

    const utc = await getMemberWrapped(db, G, ME, 2025, { now, botIds: [BOT] });
    expect(utc.persona).toEqual({ label: 'Night owl', peakHour: 0 });
    expect(utc.days.days).toEqual([{ date: '2025-02-10', minutes: 180, messages: 0 }]);
  });
});
