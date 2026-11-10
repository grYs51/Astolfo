import { isRecalculating, recalculateXp } from './recalculate';
import { grantXp } from './grant';

jest.mock('./grant', () => ({ grantXp: jest.fn(async () => ({ rows: 3, xp: 12 })) }));
jest.mock('../api/utils/discord-directory', () => ({ discordDirectory: () => ({ channel: () => undefined }) }));
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
