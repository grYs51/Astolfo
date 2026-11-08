import { Request, Response } from 'express';
import { getStatus } from './getStatus';

describe('getStatus', () => {
  test('returns the stored profile without calling Discord', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const user = { id: '1', username: 'astolfo', global_name: null, avatar: 'abc' };
    const res = { send: jest.fn() };

    getStatus({ user } as Request, res as unknown as Response, jest.fn());

    expect(res.send).toHaveBeenCalledWith(user);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
