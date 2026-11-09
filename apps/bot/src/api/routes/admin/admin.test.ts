import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getAdminServers } from './getAdminServers';
import { getAdminPeople } from './getAdminPeople';
import { getAdminUsage, p95FromBuckets } from './getAdminUsage';
import { getAdminWeb } from './getAdminWeb';
import { getAdminHealth } from './getAdminHealth';
import { broadcast, closeStuckSessions, sendBroadcast, getNotice, jsonOnly, leaveGuild, postDigestNow, setNotice } from './actions';
import { setVc } from '../../../utils/functions/set-vc';
import { postDigest } from '../../../utils/schedulers/digest.scheduler';

jest.mock('../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    guilds: () => [
      { id: 'g1', name: 'Café', icon: null, memberCount: 10, joinedAt: new Date('2026-01-01T00:00:00Z') },
      { id: 'g2', name: 'Quiet', icon: null, memberCount: 3, joinedAt: null },
    ],
  }),
}));
const mockLeave = jest.fn();
const mockSend = jest.fn();
jest.mock('../../../client/instance', () => ({
  client: {
    ws: { status: 0, ping: -1 },
    voiceUsers: new Map([['g1:m1', []]]),
    userStatus: new Map(),
    commands: new Map(),
    slashs: new Map(),
    // The bot is in g1 and g2; g3 is a server it left
    guilds: {
      cache: new Map([
        ['g1', { id: 'g1', name: 'Café', leave: () => mockLeave() }],
        ['g2', { id: 'g2', name: 'Quiet', leave: () => mockLeave() }],
      ]),
    },
    channels: {
      fetch: jest.fn(async (id: string) =>
        id === 'gone' ? null : { isSendable: () => true, send: (msg: unknown) => mockSend(id, msg) }
      ),
    },
  },
}));
jest.mock('../../../utils/schedulers/digest.scheduler', () => ({ postDigest: jest.fn() }));
jest.mock('../../../utils/handlers/vc', () => ({ closeLeftVoiceSessions: jest.fn(async () => 2) }));
jest.mock('../../../utils/functions/set-vc', () => ({ setVc: jest.fn() }));
jest.mock('../../../utils/logger', () => ({ Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

/** Runs a handler against a db whose raw queries return `results` in call order */
const run = async (handler: unknown, results: unknown[][], extra: object = {}) => {
  const queryRaw = jest.fn();
  results.forEach((rows) => queryRaw.mockResolvedValueOnce(rows));
  const db = {
    $queryRaw: queryRaw,
    guildConfigurations: { findMany: jest.fn().mockResolvedValue([]) },
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
    expect(sql[0]).toMatch(/COALESCE\(ended_on, \(NOW\(\) AT TIME ZONE 'UTC'\)\)/);
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
    const { sql } = await run(getAdminPeople, [[], [{ dau: 0, wau: 0, mau: 0, churned: 0 }], [], [{ last7d: 0, last30d: 0, total: 0, before_tracking: 0 }], [{ users: 0 }]]);
    expect(sql[0]).toMatch(/type = 'VOICE'/);
    expect(sql[0]).toMatch(/COALESCE\(ended_on, NOW\(\) AT TIME ZONE 'UTC'\)/);
  });

  test('empty tables', async () => {
    const { body } = await run(getAdminPeople, [[], [{ dau: 0, wau: 0, mau: 0, churned: 0 }], [], [{ last7d: 0, last30d: 0, total: 0, before_tracking: 0 }], [{ users: 0 }]]);
    expect(body).toMatchObject({ dau: 0, churned: 0, signIns: { total: 0, beforeTracking: 0 }, liveWebUsers: 0, hiddenMembers: 0 });
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

/** Runs an action handler with a JSON body; returns the status (200 unless set) and the body sent */
const act = async (handler: unknown, body: unknown, db: object = {}) => {
  const res = { statusCode: 200, send: jest.fn(), status: jest.fn() };
  res.status.mockImplementation((code: number) => ((res.statusCode = code), res));
  const next = jest.fn();
  await (handler as (req: Request, res: Response, next: jest.Mock) => Promise<void>)(
    { db, body } as unknown as Request,
    res as unknown as Response,
    next
  );
  expect(next).not.toHaveBeenCalled();
  return { status: res.statusCode, body: res.send.mock.calls[0][0] };
};

describe('admin actions', () => {
  beforeEach(() => jest.clearAllMocks());

  const configs = (config: object | null) => ({
    guildConfigurations: { findUnique: jest.fn().mockResolvedValue(config) },
  });

  test('digest: 400 without a guild id, 404 for a server the bot is not in', async () => {
    expect((await act(postDigestNow, {})).status).toBe(400);
    expect((await act(postDigestNow, { guildId: 'g3' })).status).toBe(404);
    expect(postDigest).not.toHaveBeenCalled();
  });

  test('digest: 409 without a digest channel or for a silent week', async () => {
    expect((await act(postDigestNow, { guildId: 'g1' }, configs({ guild_id: 'g1', digest_channel_id: null }))).status).toBe(409);
    (postDigest as jest.Mock).mockResolvedValueOnce('silent');
    expect((await act(postDigestNow, { guildId: 'g1' }, configs({ guild_id: 'g1', digest_channel_id: 'c1' }))).status).toBe(409);
  });

  test('digest: posts through the scheduler helper', async () => {
    (postDigest as jest.Mock).mockResolvedValueOnce('posted');
    const config = { guild_id: 'g1', digest_channel_id: 'c1' };
    expect(await act(postDigestNow, { guildId: 'g1' }, configs(config))).toEqual({ status: 200, body: { posted: true } });
    expect(postDigest).toHaveBeenCalledWith(expect.anything(), config);
  });

  test('leave: 404 for an unknown server, otherwise leaves it', async () => {
    expect((await act(leaveGuild, { guildId: 'g3' })).status).toBe(404);
    expect(mockLeave).not.toHaveBeenCalled();
    expect((await act(leaveGuild, { guildId: 'g2' })).status).toBe(200);
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  test('close stuck sessions returns the count and reopens switched sessions, like ShardReady', async () => {
    expect((await act(closeStuckSessions, undefined)).body).toEqual({ closed: 2 });
    expect(setVc).toHaveBeenCalledTimes(1);
  });

  test('actions refuse anything but JSON (a cross-site form POST needs no preflight)', () => {
    const check = (type: string | false) => {
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      const next = jest.fn();
      jsonOnly({ is: () => type } as unknown as Request, res as unknown as Response, next);
      return next.mock.calls.length ? 'next' : res.status.mock.calls[0][0];
    };
    expect(check('application/json')).toBe('next');
    expect(check(false)).toBe(415);
  });

  test('notice: validates, trims, and clears on null or blank', async () => {
    const appNotice = { upsert: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) };
    expect((await act(setNotice, { text: 5 }, { appNotice })).status).toBe(400);
    expect((await act(setNotice, {}, { appNotice })).status).toBe(400);
    expect((await act(setNotice, { text: 'x'.repeat(301) }, { appNotice })).status).toBe(400);
    expect(appNotice.upsert).not.toHaveBeenCalled();

    expect((await act(setNotice, { text: '  Down at 22:00  ' }, { appNotice })).body).toEqual({ text: 'Down at 22:00' });
    expect(appNotice.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { id: 1, text: 'Down at 22:00' } }));

    expect((await act(setNotice, { text: null }, { appNotice })).body).toEqual({ text: null });
    expect((await act(setNotice, { text: '   ' }, { appNotice })).body).toEqual({ text: null });
    expect(appNotice.deleteMany).toHaveBeenCalledTimes(2);

    expect((await act(getNotice, undefined, { appNotice })).body).toEqual({ text: null });
  });

  test('broadcast: 1 to 1,000 characters', async () => {
    expect((await act(broadcast, {})).status).toBe(400);
    expect((await act(broadcast, { text: '  ' })).status).toBe(400);
    expect((await act(broadcast, { text: 'x'.repeat(1001) })).status).toBe(400);
  });

  test('broadcast: answers 202 with the servers the bot is still in', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { guild_id: 'g1', digest_channel_id: 'c1' },
      { guild_id: 'g3', digest_channel_id: 'c3' }, // left
    ]);
    expect(await act(broadcast, { text: 'Hi' }, { guildConfigurations: { findMany } })).toEqual({
      status: 202,
      body: { queued: 1 },
    });
  });

  test('sendBroadcast: no pings, failures counted and skipped', async () => {
    expect(await sendBroadcast('Hello @everyone', ['c1', 'gone'])).toEqual({ posted: 1, failed: 1 });
    expect(mockSend).toHaveBeenCalledWith('c1', { content: 'Hello @everyone', allowedMentions: { parse: [] } });
  });
});
