import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getAdminServers } from './getAdminServers';
import { getAdminPeople } from './getAdminPeople';
import { getAdminUsage, p95FromBuckets } from './getAdminUsage';
import { getAdminWeb } from './getAdminWeb';
import { getAdminHealth } from './getAdminHealth';

jest.mock('../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    guilds: () => [
      { id: 'g1', name: 'Café', icon: null, memberCount: 10, joinedAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'g2', name: 'Quiet', icon: null, memberCount: 3, joinedAt: null },
    ],
  }),
}));
jest.mock('../../../client/instance', () => ({
  client: {
    ws: { status: 0, ping: -1 },
    voiceUsers: new Map([['g1:m1', []]]),
    userStatus: new Map(),
    commands: new Map(),
    slashs: new Map(),
  },
}));

/** Runs a handler against a db whose raw queries return `results` in call order */
const run = async (handler: unknown, results: unknown[][], extra: object = {}) => {
  const queryRaw = jest.fn();
  results.forEach((rows) => queryRaw.mockResolvedValueOnce(rows));
  const db = {
    $queryRaw: queryRaw,
    guildConfigurations: { findMany: jest.fn().mockResolvedValue([]) },
    session: { count: jest.fn().mockResolvedValue(0) },
    userConfigs: { count: jest.fn().mockResolvedValue(0) },
    ...extra,
  };
  const res = { send: jest.fn(), status: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await (handler as (req: Request, res: Response, next: jest.Mock) => Promise<void>)(
    { db } as unknown as Request,
    res as unknown as Response,
    next
  );
  expect(next).not.toHaveBeenCalled();
  // Renders nested Prisma.sql fragments into one statement
  const sql = queryRaw.mock.calls.map(([strings, ...values]) => Prisma.sql(strings, ...values).sql);
  return { body: res.send.mock.calls[0][0], sql };
};

describe('admin servers', () => {
  test('VOICE rows only, open sessions count live time', async () => {
    const { sql } = await run(getAdminServers, [[], []]);
    expect(sql[0]).toMatch(/type = 'VOICE'/);
    expect(sql[0]).toMatch(/COALESCE\(ended_on, NOW\(\)\)/);
  });

  test('servers with no activity get zeros, not a crash', async () => {
    const { body } = await run(getAdminServers, [[], []]);
    expect(body.joinsPerWeek).toEqual([]);
    expect(body.servers).toEqual([
      expect.objectContaining({ id: 'g1', joinedAt: '2026-01-01T00:00:00.000Z', voiceHours30d: 0, messages30d: 0, lastActivity: null, toggles: [], digest: false }),
      expect.objectContaining({ id: 'g2', joinedAt: null }),
    ]);
  });

  test('joins the SQL rows to the cache by guild id', async () => {
    const { body } = await run(getAdminServers, [
      [{ guild_id: 'g2', voice_ms: 5_400_000, messages: 7, last_at: new Date('2026-11-01T00:00:00Z') }],
      [],
    ], { guildConfigurations: { findMany: jest.fn().mockResolvedValue([{ guild_id: 'g2', toggles: 1, digest_channel_id: 'c' }]) } });
    expect(body.servers[1]).toMatchObject({ voiceHours30d: 1.5, messages30d: 7, toggles: ['Voice Channel Reminder'], digest: true });
  });
});

describe('admin people', () => {
  test('VOICE rows only, open sessions run to now', async () => {
    const { sql } = await run(getAdminPeople, [[], [{ dau: 0, wau: 0, mau: 0, churned: 0 }], [], [{ last7d: 0, last30d: 0, total: 0, before_tracking: 0 }]]);
    expect(sql[0]).toMatch(/type = 'VOICE'/);
    expect(sql[0]).toMatch(/COALESCE\(ended_on, NOW\(\) AT TIME ZONE 'UTC'\)/);
  });

  test('empty tables', async () => {
    const { body } = await run(getAdminPeople, [[], [{ dau: 0, wau: 0, mau: 0, churned: 0 }], [], [{ last7d: 0, last30d: 0, total: 0, before_tracking: 0 }]]);
    expect(body).toMatchObject({ dau: 0, churned: 0, signIns: { total: 0, beforeTracking: 0 }, liveWebSessions: 0, hiddenMembers: 0 });
  });
});

describe('admin usage', () => {
  test('lists routes from the live counters with nothing in metric_daily', async () => {
    const { body, sql } = await run(getAdminUsage, [[], []]);
    expect(body.commands).toEqual([]);
    expect(body.daily).toEqual([]);
    expect(Array.isArray(body.routes)).toBe(true);
    expect(sql[0]).toMatch(/LAG\(value\)/);
  });

  test('p95 from cumulative histogram buckets', () => {
    const buckets = (counts: number[]) =>
      [0.01, 0.1, 1, Infinity].map((le, i) => ({ le, count: counts[i] }));
    expect(p95FromBuckets([])).toBeNull();
    expect(p95FromBuckets(buckets([0, 0, 0, 0]))).toBeNull();
    expect(p95FromBuckets(buckets([90, 100, 100, 100]))).toBe(100);
    expect(p95FromBuckets(buckets([95, 100, 100, 100]))).toBe(10);
    expect(p95FromBuckets(buckets([0, 0, 0, 10]))).toBeNull(); // slower than the top bucket
  });
});

describe('admin web and health', () => {
  test('web with no page views', async () => {
    const { body } = await run(getAdminWeb, [[], []]);
    expect(body).toEqual({ daily: [], topPages: [] });
  });

  test('health converts bigints and hides the -1 ping', async () => {
    const { body } = await run(getAdminHealth, [[{ size: BigInt(2048) }], [{ name: 'voice_stats', rows: BigInt(5) }]]);
    expect(body).toMatchObject({
      gateway: { status: 'Ready', pingMs: null },
      openVoiceSessions: 1,
      database: { sizeBytes: 2048, tables: [{ name: 'voice_stats', rows: 5 }] },
    });
  });
});
