import { Request, Response } from 'express';
import { getWrapped } from './getWrapped';
import { getMemberWrapped } from '../../../../stats/queries';
import { latestWrappedYear } from '../../../../stats/wrapped-year';

jest.mock('../../../../stats/queries', () => ({ getMemberWrapped: jest.fn() }));
jest.mock('../../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    members: async () => new Map([['b', { id: 'b', username: 'brad', displayName: 'Bradamante', avatar: null }]]),
    channel: (_guildId: string, id: string) => ({ id, name: 'round-table', type: 'GuildVoice' }),
    guild: () => ({ name: 'Paladins', icon: null }),
    botIds: () => ['music-bot'],
  }),
}));

const get = async (year?: string, extra: Record<string, string> = {}) => {
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  await getWrapped(
    { params: { serverId: 'g', userId: 'me' }, query: { ...(year === undefined ? {} : { year }), ...extra }, db: {} } as unknown as Request<{ serverId: string; userId: string }>,
    res as unknown as Response,
    jest.fn()
  );
  return res;
};

beforeEach(() => jest.clearAllMocks());

test.each(['abc', '2019', String(latestWrappedYear() + 1), '2025.5'])('400 for year=%s', async (year) => {
  const res = await get(year);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(getMemberWrapped).not.toHaveBeenCalled();
});

test('the latest open year by default, with names for the channel and the duo', async () => {
  (getMemberWrapped as jest.Mock).mockResolvedValue({
    year: 2026,
    topChannels: [{ channelId: 'vc1', voiceMs: 5 }],
    buddies: [{ memberId: 'b', togetherMs: 1 }],
  });
  const res = await get();
  expect((getMemberWrapped as jest.Mock).mock.calls[0].slice(1)).toEqual([
    'g',
    'me',
    latestWrappedYear(),
    { now: expect.any(Date), tz: 'UTC', botIds: ['music-bot'] },
  ]);
  expect(res.send).toHaveBeenCalledWith(
    expect.objectContaining({
      serverName: 'Paladins',
      member: { id: 'me', username: 'Unknown User', displayName: null, avatar: null },
      topChannels: [{ channel: { id: 'vc1', name: 'round-table', type: 'GuildVoice' }, voiceMs: 5 }],
      buddies: [{ member: expect.objectContaining({ id: 'b', displayName: 'Bradamante' }), togetherMs: 1 }],
    })
  );
});

test("the viewer's time zone, and UTC for an unknown one", async () => {
  (getMemberWrapped as jest.Mock).mockResolvedValue({ year: 2026, topChannels: [], buddies: [] });
  await get(undefined, { tz: 'America/New_York' });
  await get(undefined, { tz: 'Not/AZone' });
  expect((getMemberWrapped as jest.Mock).mock.calls.map((call) => call[4].tz)).toEqual(['America/New_York', 'UTC']);
});
