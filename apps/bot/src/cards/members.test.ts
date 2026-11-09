import { cardMembers } from './members';

jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn() } }));

const member = (id: string, name: string) => ({ id, displayName: name, displayAvatarURL: () => undefined });

const guildWith = (cached: string[], fetched: string[] = [], fails = false) => {
  const cache = new Map(cached.map((id) => [id, member(id, `cached ${id}`)]));
  const fetch = jest.fn(async () => {
    if (fails) throw new Error('rate limited');
    fetched.forEach((id) => cache.set(id, member(id, `fetched ${id}`)));
  });
  return { guild: { id: 'g', members: { cache, fetch } } as never, fetch };
};

describe('cardMembers', () => {
  it('fetches only the members the cache is missing, once', async () => {
    const { guild, fetch } = guildWith(['1'], ['2']);
    const members = await cardMembers(guild, ['1', '2', '2']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith({ user: ['2'] });
    expect(members['1'].name).toBe('cached 1');
    expect(members['2'].name).toBe('fetched 2');
  });

  it('skips the fetch when everyone is cached', async () => {
    const { guild, fetch } = guildWith(['1']);
    await cardMembers(guild, ['1']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to Unknown member when the fetch fails or the member left', async () => {
    const { guild } = guildWith([], [], true);
    expect((await cardMembers(guild, ['9']))['9']).toEqual({ name: 'Unknown member', avatar: undefined });
  });
});
