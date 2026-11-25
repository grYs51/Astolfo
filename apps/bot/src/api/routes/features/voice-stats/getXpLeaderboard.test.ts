import { Request, Response } from 'express';
import { getXpLeaderboard, XpRankRow } from './getXpLeaderboard';

// 60 ranked members m1..m60; m1 is new this week and pushed everyone else down one place
const ranks: XpRankRow[] = Array.from({ length: 60 }, (_, i) => ({
  member_id: `m${i + 1}`,
  xp: 1000 - i,
  week_xp: 5,
  rank: i + 1,
  rank_before: i === 0 ? null : i,
}));

jest.mock('../../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    memberIds: async () => [],
    members: async () => new Map(),
  }),
}));

const get = async (query: Record<string, string>, viewer = 'm30') => {
  const res = { send: jest.fn() };
  await getXpLeaderboard(
    {
      params: { serverId: 'g' },
      query,
      user: { id: viewer },
      db: { $queryRaw: async () => ranks },
    } as unknown as Request<{ serverId: string }>,
    res as unknown as Response,
    jest.fn()
  );
  return res.send.mock.calls[0][0];
};

const ids = (rows: { member: { id: string } }[]) => rows.map((row) => row.member.id);

test('25 a page, with the viewer pinned as me', async () => {
  const body = await get({ page: '3' });
  expect(body).toMatchObject({ page: 3, pages: 3, total: 60, me: { rank: 30, rankChange: -1, isNew: false } });
  expect(ids(body.leaderboard)).toEqual(Array.from({ length: 10 }, (_, i) => `m${51 + i}`));
});

test('a bad or out-of-range page falls back into range', async () => {
  expect((await get({ page: 'x' })).page).toBe(1);
  expect((await get({ page: '99' })).page).toBe(3);
});

test('new members are flagged', async () => {
  expect((await get({})).leaderboard[0]).toMatchObject({ rank: 1, rankChange: 0, isNew: true, weekXp: 5 });
});

test('around a member: two on each side, fewer at the ends', async () => {
  expect(ids((await get({ around: 'm30' })).leaderboard)).toEqual(['m28', 'm29', 'm30', 'm31', 'm32']);
  expect(ids((await get({ around: 'm1' })).leaderboard)).toEqual(['m1', 'm2', 'm3']);
  expect(ids((await get({ around: 'm60' })).leaderboard)).toEqual(['m58', 'm59', 'm60']);
  expect((await get({ around: 'nobody' })).leaderboard).toEqual([]);
});
