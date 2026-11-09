import { Request, Response } from 'express';
import { getStatus } from './getStatus';

describe('getStatus', () => {
  const user = { id: '1', username: 'astolfo', global_name: null, avatar: 'abc' };
  const status = (owner: string | undefined) => {
    process.env.OWNER = owner;
    const res = { send: jest.fn() };
    getStatus({ user } as Request, res as unknown as Response, jest.fn());
    return res.send.mock.calls[0][0];
  };
  afterEach(() => delete process.env.OWNER);

  test('returns the stored profile without calling Discord', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(status('2')).toEqual({ ...user, isOwner: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('flags the owner', () => {
    expect(status('1').isOwner).toBe(true);
  });
});
