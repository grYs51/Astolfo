import { Request, Response, Router } from 'express';
import { isServerMember } from './isServerMember';
import registerFeatures from '../../routes/features';

const mockIsMember = jest.fn();
jest.mock('../discord-directory', () => ({
  discordDirectory: () => ({ isMember: mockIsMember }),
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

  // The only thing keeping one server's stats from every logged-in user
  test('every voice-stats route checks membership', () => {
    const router = Router();
    registerFeatures(router);
    const routes = router.stack
      .map((layer) => layer.route)
      .filter((route) => route?.path.startsWith('/features/voice-stats/'));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.stack.map((layer: { handle: unknown }) => layer.handle)).toContain(isServerMember);
    }
  });
});
