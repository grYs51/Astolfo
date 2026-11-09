import { Request, Response, Router } from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { isServerManager } from './isServerManager';
import { isServerMember } from './isServerMember';
import registerFeatures from '../../routes/features';
import { ServiceUnavailable } from '../http-errors';

const mockCanManage = jest.fn();
jest.mock('../discord-directory', () => ({
  ...jest.requireActual('../discord-directory'),
  discordDirectory: () => ({ canManage: mockCanManage }),
}));

const mockHas = jest.fn();
jest.mock('../../../client/instance', () => {
  const bot = { id: 'bot' };
  const viewer = { permissions: { has: (p: bigint) => mockHas(p) } };
  // Who may do what in each channel: [type, bot can post, viewer can see]
  const channel = (id: string, type: number, botCan: boolean, viewerCan: boolean, rawPosition: number) => ({
    id,
    name: id,
    type,
    rawPosition,
    permissionsFor: (who: unknown) => ({ has: () => (who === bot ? botCan : viewerCan) }),
  });
  return {
    client: {
      guilds: {
        cache: new Map([
          [
            'guild-1',
            {
              members: { me: bot, cache: new Map([['member', viewer]]), fetch: jest.fn() },
              channels: {
                cache: new Map(
                  [
                    channel('news', 5, true, true, 2),
                    channel('general', 0, true, true, 1),
                    channel('staff', 0, true, false, 3), // private to the viewer
                    channel('rules', 0, false, true, 4), // bot can't post
                    channel('lobby', 2, true, true, 5), // voice
                  ].map((c) => [c.id, c])
                ),
              },
            },
          ],
        ]),
      },
    },
  };
});

const check = async (params: Record<string, string>, userId?: string) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await isServerManager(
    { params, user: userId ? { id: userId } : undefined } as unknown as Request<{ serverId: string }>,
    res as unknown as Response,
    next
  );
  return { res, next };
};

beforeEach(() => jest.clearAllMocks());

describe('isServerManager', () => {
  test('400 without a serverId, 401 without a user', async () => {
    expect((await check({}, 'member')).res.status).toHaveBeenCalledWith(400);
    expect((await check({ serverId: 'guild-1' })).res.status).toHaveBeenCalledWith(401);
  });

  test('403 for a member without Manage Server', async () => {
    mockCanManage.mockResolvedValue(false);
    const { res, next } = await check({ serverId: 'guild-1' }, 'member');
    expect(mockCanManage).toHaveBeenCalledWith('guild-1', 'member');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('lets a manager through', async () => {
    mockCanManage.mockResolvedValue(true);
    const { res, next } = await check({ serverId: 'guild-1' }, 'member');
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('a failed Discord lookup goes to the error handler, not a 403', async () => {
    const error = new ServiceUnavailable();
    mockCanManage.mockRejectedValue(error);
    const { res, next } = await check({ serverId: 'guild-1' }, 'member');
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  // The only thing keeping server settings from every member
  test('every settings route checks membership and Manage Server', () => {
    const router = Router();
    registerFeatures(router);
    const routes = router.stack
      .map((layer) => layer.route)
      .filter((route) => route?.path.includes('/settings'));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const handles = route.stack.map((layer: { handle: unknown }) => layer.handle);
      expect(handles).toContain(isServerMember);
      expect(handles).toContain(isServerManager);
    }
  });
});

describe('live canManage', () => {
  const { discordDirectory } = jest.requireActual('../discord-directory');

  test('asks for Manage Server', async () => {
    mockHas.mockReturnValue(true);
    await expect(discordDirectory().canManage('guild-1', 'member')).resolves.toBe(true);
    expect(mockHas).toHaveBeenCalledWith(PermissionFlagsBits.ManageGuild);
  });

  test('false without it, or outside the server', async () => {
    mockHas.mockReturnValue(false);
    await expect(discordDirectory().canManage('guild-1', 'member')).resolves.toBe(false);
    await expect(discordDirectory().canManage('other-guild', 'member')).resolves.toBe(false);
  });
});

describe('live postableChannels', () => {
  const { discordDirectory } = jest.requireActual('../discord-directory');

  test('text and announcement channels the bot can post in and the viewer can see, in order', async () => {
    const channels = await discordDirectory().postableChannels('guild-1', 'member');
    expect(channels.map((c: { id: string }) => c.id)).toEqual(['general', 'news']);
  });

  test('nothing for someone outside the server', async () => {
    await expect(discordDirectory().postableChannels('other-guild', 'member')).resolves.toEqual([]);
  });
});
