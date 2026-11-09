import { Request, Response } from 'express';
import { getStatsCard } from './getStatsCard';
import { statsCardSvg } from '../../../../cards/stats-card-svg';

jest.mock('../../../../cards/stats-card-svg', () => ({
  statsCardSvg: jest.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'),
}));

const HIDDEN = 'hidden';

const get = async (userId: string, period?: string) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    attachment: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const db = {
    userConfigs: { findFirst: jest.fn(async ({ where }: { where: { user_id: string } }) => (where.user_id === HIDDEN ? {} : null)) },
  };
  await getStatsCard(
    { params: { serverId: 'g', userId }, query: period ? { period } : {}, user: { id: 'viewer' }, db } as unknown as Request<{ serverId: string; userId: string }>,
    res as unknown as Response,
    jest.fn()
  );
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('getStatsCard', () => {
  test('400 for an unknown period', async () => {
    const res = await get('member', 'day');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(statsCardSvg).not.toHaveBeenCalled();
  });

  test('403 when the member hides from the viewer', async () => {
    const res = await get(HIDDEN, 'week');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(statsCardSvg).not.toHaveBeenCalled();
  });

  test('a private PNG download of the card the viewer may see', async () => {
    const res = await get('member', 'year');
    expect(statsCardSvg).toHaveBeenCalledWith(
      expect.objectContaining({ guildId: 'g', memberId: 'member', viewerId: 'viewer', period: 'year' })
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.type).toHaveBeenCalledWith('png');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
    expect(res.attachment).toHaveBeenCalledWith('stats.png');
    const png: Buffer = res.send.mock.calls[0][0];
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  test('defaults to the past month, like /stats', async () => {
    await get('member');
    expect(statsCardSvg).toHaveBeenCalledWith(expect.objectContaining({ period: 'month' }));
  });
});
