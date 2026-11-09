import { saveGuildConfig } from './set-config';

jest.mock('../../client/instance', () => ({ client: {} }));

const setup = () => {
  const saved = { guild_id: 'g', prefix: '?' };
  const upsert = jest.fn().mockReturnValue('upsert-query');
  const create = jest.fn().mockReturnValue('log-query');
  const $transaction = jest.fn().mockResolvedValue([saved, {}]);
  const discord = {
    guildConfigs: new Map(),
    dataSource: {
      guildConfigurations: { upsert },
      settingsChanges: { create },
      $transaction,
    },
  };
  return { discord, saved, upsert, create, $transaction };
};

describe('saveGuildConfig audit', () => {
  test('logs the changes in the same transaction as the write', async () => {
    const { discord, saved, create, $transaction } = setup();
    const changes = [{ field: 'prefix', from: '!', to: '?' }];
    await saveGuildConfig(discord as never, 'g', { prefix: '?' }, { userId: 'u', changes });

    expect(create).toHaveBeenCalledWith({ data: { guild_id: 'g', user_id: 'u', changes } });
    expect($transaction).toHaveBeenCalledWith(['upsert-query', 'log-query']);
    expect(discord.guildConfigs.get('g')).toBe(saved);
  });

  test('a save that changed nothing writes no log row', async () => {
    const { discord, upsert, create, $transaction } = setup();
    upsert.mockResolvedValue({ guild_id: 'g' });
    await saveGuildConfig(discord as never, 'g', { prefix: '!' }, { userId: 'u', changes: [] });

    expect(create).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });
});
