import { Profile } from 'passport-discord';
import { verifyDiscordLogin } from './discordStrategy';

const upsert = jest.fn();
jest.mock('../../../db', () => ({ getDb: () => ({ userSession: { upsert } }) }));

describe('verifyDiscordLogin', () => {
  test('saves the profile and no OAuth token', async () => {
    const row = { id: '1', username: 'astolfo', global_name: 'Astolfo', avatar: 'abc' };
    upsert.mockResolvedValue(row);
    const done = jest.fn();
    const profile = { ...row, discriminator: '0', email: 'x@y.z' } as unknown as Profile;

    await verifyDiscordLogin('access-secret', 'refresh-secret', profile, done);

    const fields = { username: 'astolfo', global_name: 'Astolfo', avatar: 'abc' };
    expect(upsert).toHaveBeenCalledWith({
      where: { id: '1' },
      create: { id: '1', ...fields },
      update: fields,
    });
    expect(JSON.stringify(upsert.mock.calls)).not.toMatch(/secret/);
    expect(done).toHaveBeenCalledWith(null, row);
  });
});
