import { isRecalculating, isXpBusy, recalculateXp, sweepXp } from './recalculate';
import { grantXp, guildTotals } from './grant';
import { postLevelUp } from './announce';

jest.mock('./grant', () => ({ grantXp: jest.fn(async () => ({ rows: 3, xp: 12 })), guildTotals: jest.fn() }));
jest.mock('./announce', () => ({ postLevelUp: jest.fn(async () => undefined) }));
jest.mock('../api/utils/discord-directory', () => ({
  discordDirectory: () => ({ channel: () => undefined, guilds: () => [{ id: 's' }] }),
}));
jest.mock('../utils/logger', () => ({ Logger: { info: jest.fn(), error: jest.fn() } }));

test('a second call during a run is refused, and the lock is released after', async () => {
  let finish: () => void = () => undefined;
  const tx = { $executeRaw: jest.fn() };
  const client = {
    users: { cache: new Map() },
    dataSource: {
      $transaction: jest.fn((run: (t: typeof tx) => Promise<unknown>) =>
        new Promise((resolve) => {
          finish = () => resolve(run(tx));
        })
      ),
    },
  } as never;

  const first = recalculateXp(client, 'g');
  expect(isRecalculating('g')).toBe(true);
  await expect(recalculateXp(client, 'g')).rejects.toThrow(/already being recalculated/);
  finish();
  await expect(first).resolves.toMatchObject({ rows: 3, xp: 12 });
  expect(tx.$executeRaw).toHaveBeenCalled();
  expect((grantXp as jest.Mock).mock.calls[0][1]).toMatchObject({ guildId: 'g' });
  expect(isRecalculating('g')).toBe(false);
});

describe('sweepXp', () => {
  const client = {
    users: { cache: new Map() },
    dataSource: {},
    guildConfigs: new Map([['s', { level_up_channel_id: 'levels' }]]),
  } as never;
  const totals = guildTotals as jest.Mock;

  test('posts the level-ups it caused, but not the backfill’s', async () => {
    // The backfill: no XP before it
    totals.mockResolvedValueOnce(new Map());
    await sweepXp(client);
    expect(postLevelUp).not.toHaveBeenCalled();
    // Level 5 starts at 1,000 XP under the default curve
    totals.mockResolvedValueOnce(new Map([['a', 990], ['b', 500]])).mockResolvedValueOnce(
      new Map([['a', 1002], ['b', 500], ['c', 20]])
    );
    await sweepXp(client);
    expect(postLevelUp).toHaveBeenCalledTimes(1);
    expect(postLevelUp).toHaveBeenCalledWith(client, 's', 'a', 5);
  });

  test('holds the guild, so a recalculation is refused until it ends', async () => {
    let finish: () => void = () => undefined;
    (grantXp as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ rows: 0, xp: 0 })))
    );
    const run = sweepXp(client);
    expect(isXpBusy('s')).toBe(true);
    expect(isRecalculating('s')).toBe(false);
    await expect(recalculateXp(client, 's')).rejects.toThrow(/being swept/);
    await new Promise(setImmediate);
    finish();
    await run;
    expect(isXpBusy('s')).toBe(false);
  });
});
