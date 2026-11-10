import { Request, Response } from 'express';
import { getUserXp } from './getUserXp';

jest.mock('../../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    members: async (_g: string, ids: string[]) =>
      new Map(ids.filter((id) => id === 'kai').map((id) => [id, { id, username: 'kai', displayName: 'Kai', avatar: null }])),
    channel: (_g: string, id: string) => (id === 'vc1' ? { id, name: 'Lobby', type: 'GuildVoice' } : undefined),
  }),
}));

const at = (min: number) => new Date(Date.UTC(2026, 10, 10, 12, min));
const row = (id: string, min: number, extra: object = {}) => ({
  id,
  guild_id: 'g',
  member_id: 'me',
  source: 'MESSAGE',
  amount: 2,
  note: 'Sent a message',
  key: `msg:${id}`,
  created_at: at(min),
  segments: null,
  ...extra,
});

const run = async (query: object, rows: object[]) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([{ xp: 1250 }]),
    xpEvents: { findMany },
    voiceStats: { findMany: jest.fn().mockResolvedValue([{ id: 's1', channel_id: 'vc1' }]) },
  };
  const res = { statusCode: 200, send: jest.fn(), status: jest.fn() };
  res.status.mockImplementation((code: number) => ((res.statusCode = code), res));
  await (getUserXp as unknown as (req: Request, res: Response, next: jest.Mock) => Promise<void>)(
    { db, query, params: { serverId: 'g', userId: 'me' } } as unknown as Request,
    res as unknown as Response,
    jest.fn()
  );
  return { status: res.statusCode, body: res.send.mock.calls[0][0], findMany };
};

test('a bad cursor is a 400', async () => {
  expect((await run({ before: 'nope' }, [])).status).toBe(400);
  expect((await run({ before: ['a', 'b'] }, [])).status).toBe(400);
});

test('level, voice rows with their channel and people, and a cursor when there is more', async () => {
  const segment = { from: 0, to: 1, memberIds: ['kai', 'gone'], deaf: false, stay: 1, camera: false, streaming: false, multiplier: 1.12 };
  const rows = [row('v', 30, { source: 'VOICE', key: 'voice:s1', segments: [segment] }), ...Array.from({ length: 25 }, (_, i) => row(`m${i}`, 29 - i))];
  const { body } = await run({}, rows);
  expect(body.level).toMatchObject({ xp: 1250, level: 5 });
  expect(body.entries).toHaveLength(25);
  expect(body.entries[0]).toMatchObject({ source: 'VOICE', channel: { name: 'Lobby' }, segments: [segment] });
  expect(body.entries[1].channel).toBeUndefined();
  expect(body.people).toEqual({
    kai: { id: 'kai', username: 'kai', displayName: 'Kai', avatar: null },
    gone: { id: 'gone', username: 'Unknown User', displayName: null, avatar: null },
  });
  expect(body.nextCursor).toBe(`${at(29 - 23).toISOString()}|m23`);
});

test('the cursor pages after that row', async () => {
  const { findMany, body } = await run({ before: `${at(5).toISOString()}|m3` }, [row('m4', 4)]);
  expect(findMany.mock.calls[0][0].where.OR).toEqual([{ created_at: { lt: at(5) } }, { created_at: at(5), id: { lt: 'm3' } }]);
  expect(body.nextCursor).toBeNull();
});
