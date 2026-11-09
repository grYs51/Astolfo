import { Request, Response, Router } from 'express';
import { isOwner } from './isOwner';
import { isAuthenticated } from './isAuthenticated';
import { Forbidden, Unauthorized } from '../http-errors';
import registerAdmin from '../../routes/admin';
import { jsonOnly } from '../../routes/admin/actions';

const check = (user?: { id: string }) => {
  const next = jest.fn();
  isOwner({ user } as Request, {} as Response, next);
  return next.mock.calls[0][0];
};

describe('isOwner', () => {
  afterEach(() => delete process.env.OWNER);

  test('401 without a user', () => {
    process.env.OWNER = 'owner';
    expect(check()).toBeInstanceOf(Unauthorized);
  });

  test('403 for anyone else', () => {
    process.env.OWNER = 'owner';
    expect(check({ id: 'someone' })).toBeInstanceOf(Forbidden);
  });

  test('403 for everyone when OWNER is unset', () => {
    expect(check({ id: '' })).toBeInstanceOf(Forbidden);
    expect(check({ id: 'owner' })).toBeInstanceOf(Forbidden);
  });

  test('lets the owner through', () => {
    process.env.OWNER = 'owner';
    expect(check({ id: 'owner' })).toBeUndefined();
  });

  // The only thing keeping the admin panel from every logged-in user
  test('every admin route checks login and owner, /notice is the only public one', () => {
    const router = Router();
    registerAdmin(router);
    const routes = router.stack.flatMap((layer) => layer.route ?? []);
    const isPublic = (route: { path: string }) => route.path === '/notice';

    expect(routes.length).toBe(11);
    // Mounted ahead of the action routes, so they only take JSON
    expect(router.stack.some((layer) => !layer.route && layer.handle === jsonOnly)).toBe(true);
    expect(routes.filter(isPublic)).toHaveLength(1);
    for (const route of routes.filter((r) => !isPublic(r))) {
      expect(route.path).toMatch(/^\/admin\//);
      const handles = route.stack.map((layer: { handle: unknown }) => layer.handle);
      expect(handles.slice(0, 2)).toEqual([isAuthenticated, isOwner]);
    }
  });
});
