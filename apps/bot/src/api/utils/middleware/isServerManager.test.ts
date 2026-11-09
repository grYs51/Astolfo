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
jest.mock('../../../client/instance', () => ({
  client: {
    guilds: {
      cache: new Map([
        [
          'guild-1',
          {
            members: {
              cache: new Map([['member', { permissions: { has: (p: bigint) => mockHas(p) } }]]),
              fetch: jest.fn(),
            },
          },
        ],
      ]),
    },
  },
}));

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
      .filter((route) => route?.path.endsWith('/settings'));

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
