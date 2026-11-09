import { Request, Response } from 'express';
import { trackPageView } from './trackPageView';

const track = async (path: unknown) => {
  const executeRaw = jest.fn();
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn(), end: jest.fn() };
  await trackPageView(
    { body: { path }, user: { id: 'u1' }, db: { $executeRaw: executeRaw } } as unknown as Request,
    res as unknown as Response,
    jest.fn()
  );
  return { status: res.status.mock.calls[0][0], executeRaw };
};

describe('trackPageView', () => {
  test('counts a route pattern for the viewer', async () => {
    const { status, executeRaw } = await track('overview/detail/:id/members/:memberId');
    expect(status).toBe(204);
    const [sql, path, userId] = executeRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/DO UPDATE SET views = page_views.views \+ 1/);
    expect([path, userId]).toEqual(['overview/detail/:id/members/:memberId', 'u1']);
  });

  test.each([undefined, 42, '', 'overview/détail', 'overview?id=1', 'https://x.y/z', 'a'.repeat(101), 'overview/detail/300000000000000001'])(
    'rejects %p',
    async (path) => {
      const { status, executeRaw } = await track(path);
      expect(status).toBe(400);
      expect(executeRaw).not.toHaveBeenCalled();
    }
  );
});
