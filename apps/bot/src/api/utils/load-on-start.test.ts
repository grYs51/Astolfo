import { initPrometheusData } from './load-on-start';
import { commandsCounter, slashCounter } from './counter';

const findUnique = jest.fn();
jest.mock('../../db', () => ({ getDb: () => ({ metrics: { findUnique } }) }));

const valueOf = async (counter: typeof commandsCounter, label: string) =>
  (await counter.get()).values.find((v) => Object.values(v.labels)[0] === label)?.value;

describe('initPrometheusData', () => {
  test('restores saved counters by name and skips one that no longer fits', async () => {
    findUnique.mockResolvedValue({
      jsonb: [
        { name: 'discord_bot_commands_total', type: 'counter', values: [{ labels: { commandName: 'ping' }, value: 3 }] },
        // A label that was renamed since this was saved: prom-client throws on it
        { name: 'discord_bot_slash_total', type: 'counter', values: [{ labels: { oldLabel: 'x' }, value: 9 }] },
        { name: 'discord_gone_total', type: 'counter', values: [{ labels: {}, value: 1 }] },
      ],
    });

    await expect(initPrometheusData()).resolves.toBeUndefined();

    expect(await valueOf(commandsCounter, 'ping')).toBe(3);
    expect((await slashCounter.get()).values).toEqual([]);
  });
});
