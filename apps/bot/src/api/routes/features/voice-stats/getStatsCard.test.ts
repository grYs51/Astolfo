import { Request, Response } from 'express';
import { getStatsCard } from './getStatsCard';
import { statsCardSvg } from '../../../../cards/stats-card-svg';
import { DEFAULT_SECTIONS } from '../../../../cards/stats.card';
import { DEFAULT_THEME, THEMES } from '../../../../cards/themes';

jest.mock('../../../../cards/stats-card-svg', () => ({
  statsCardSvg: jest.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>'),
}));

const get = async (userId: string, period?: string, extra: Record<string, string> = {}) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    attachment: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
  const db = {};
  const next = jest.fn();
  await getStatsCard(
    { params: { serverId: 'g', userId }, query: { ...(period ? { period } : {}), ...extra }, user: { id: 'viewer' }, db } as unknown as Request<{ serverId: string; userId: string }>,
    res as unknown as Response,
    next
  );
  return Object.assign(res, { next });
};

beforeEach(() => jest.clearAllMocks());

describe('getStatsCard', () => {
  test('400 for an unknown period', async () => {
    const res = await get('member', 'day');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(statsCardSvg).not.toHaveBeenCalled();
  });

  test('a private PNG download of the card', async () => {
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

  test('a failed render sets no PNG headers, so the error handler answers with plain JSON', async () => {
    jest.mocked(statsCardSvg).mockResolvedValueOnce('not an svg');
    const res = await get('member', 'week');
    expect(res.next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('SVG') }));
    expect(res.type).not.toHaveBeenCalled();
    expect(res.attachment).not.toHaveBeenCalled();
    expect(res.set).not.toHaveBeenCalled();
  });

  test('400 for an unknown theme or section', async () => {
    expect((await get('member', 'week', { theme: 'neon' })).status).toHaveBeenCalledWith(400);
    expect((await get('member', 'week', { theme: 'constructor' })).status).toHaveBeenCalledWith(400);
    expect((await get('member', 'week', { sections: 'totals,secrets' })).status).toHaveBeenCalledWith(400);
    expect(statsCardSvg).not.toHaveBeenCalled();
  });

  test('the picked theme, sections in card order and the time zone', async () => {
    await get('member', 'week', { theme: 'light', sections: 'heatmap,totals,calendar', tz: 'Europe/Brussels' });
    expect(statsCardSvg).toHaveBeenCalledWith(
      expect.objectContaining({ theme: THEMES.light, sections: ['totals', 'calendar', 'heatmap'], tz: 'Europe/Brussels' })
    );
  });

  test('without options: the /stats sections in the default theme, in UTC', async () => {
    await get('member', 'week', { tz: 'Not/AZone' });
    expect(statsCardSvg).toHaveBeenCalledWith(
      expect.objectContaining({ theme: THEMES[DEFAULT_THEME], sections: DEFAULT_SECTIONS, tz: 'UTC' })
    );
  });

  test('defaults to the past month, like /stats', async () => {
    await get('member');
    expect(statsCardSvg).toHaveBeenCalledWith(expect.objectContaining({ period: 'month' }));
  });
});
