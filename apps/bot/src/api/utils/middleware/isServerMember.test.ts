import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { Request, Response, Router } from 'express';
import { isServerMember } from './isServerMember';
import registerFeatures from '../../routes/features';
import { ServiceUnavailable } from '../http-errors';

const mockIsMember = jest.fn();
jest.mock('../discord-directory', () => ({
  discordDirectory: () => ({ isMember: mockIsMember }),
}));

const mockMemberFetch = jest.fn();
jest.mock('../../../client/instance', () => ({
  client: {
    guilds: {
      cache: new Map([
        ['guild-1', { members: { cache: new Map(), fetch: (id: string) => mockMemberFetch(id) } }],
      ]),
    },
  },
}));

const check = async (userId: string) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await isServerMember(
    { params: { serverId: 'guild-1' }, user: { id: userId } } as unknown as Request<{ serverId: string }>,
    res as unknown as Response,
    next
  );
  return { res, next };
};

describe('isServerMember', () => {
  test('403 for someone who is not in the server', async () => {
    mockIsMember.mockResolvedValue(false);
    const { res, next } = await check('outsider');
    expect(mockIsMember).toHaveBeenCalledWith('guild-1', 'outsider');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('lets a member through', async () => {
    mockIsMember.mockResolvedValue(true);
    const { res, next } = await check('member');
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('a failed Discord lookup goes to the error handler, not a 403', async () => {
    const error = new ServiceUnavailable();
    mockIsMember.mockRejectedValue(error);
    const { res, next } = await check('member');
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  // The only thing keeping one server's stats from every logged-in user
  test('every voice-stats route checks membership', () => {
    const router = Router();
    registerFeatures(router);
    const routes = router.stack
      .flatMap((layer) => layer.route ?? [])
      .filter((route) => route.path.startsWith('/features/voice-stats/'));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.stack.map((layer: { handle: unknown }) => layer.handle)).toContain(isServerMember);
    }
  });
});

describe('live isMember', () => {
  const { discordDirectory } = jest.requireActual('../discord-directory');
  const discordError = (code: number, status: number) =>
    new DiscordAPIError({ code, message: 'x' }, code, status, 'GET', '/members/1', {});

  test('Unknown Member means not a member', async () => {
    mockMemberFetch.mockRejectedValue(discordError(RESTJSONErrorCodes.UnknownMember, 404));
    await expect(discordDirectory().isMember('guild-1', 'outsider')).resolves.toBe(false);
  });

  test('a rate limit or outage is a 503, not "not a member"', async () => {
    mockMemberFetch.mockRejectedValue(discordError(0, 429));
    await expect(discordDirectory().isMember('guild-1', 'member')).rejects.toBeInstanceOf(ServiceUnavailable);
    mockMemberFetch.mockRejectedValue(new Error('timeout'));
    await expect(discordDirectory().isMember('guild-1', 'member')).rejects.toBeInstanceOf(ServiceUnavailable);
  });
});
