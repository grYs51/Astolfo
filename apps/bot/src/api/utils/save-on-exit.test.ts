import { dailyRows, saveDailyMetrics } from './save-on-exit';

const executeRaw = jest.fn();
jest.mock('../../db', () => ({ getDb: () => ({ $executeRaw: executeRaw }) }));

const metrics = [
  {
    name: 'discord_bot_commands_total',
    type: 'counter',
    values: [
      { labels: { commandName: 'ping' }, value: 3 },
      { labels: { commandName: 'help' }, value: 1 },
    ],
  },
  {
    name: 'discord_api_requests_total',
    type: 'counter',
    values: [{ labels: { status: 200, route: '/api/admin/health', method: 'GET' }, value: 7 }],
  },
  { name: 'discord_some_gauge', type: 'gauge', values: [{ labels: {}, value: 5 }] },
];

describe('daily metrics', () => {
  test('one row per counter label set, labels joined in key order', () => {
    expect(dailyRows(metrics)).toEqual([
      { name: 'discord_bot_commands_total', label: 'ping', value: 3 },
      { name: 'discord_bot_commands_total', label: 'help', value: 1 },
      { name: 'discord_api_requests_total', label: 'GET|/api/admin/health|200', value: 7 },
    ]);
  });

  test("upserts today's totals in one statement", async () => {
    await saveDailyMetrics(metrics);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [sql, names, labels, values] = executeRaw.mock.calls[0];
    expect(sql.join('?')).toMatch(/ON CONFLICT \(day, name, label\) DO UPDATE SET value = EXCLUDED.value/);
    expect(names).toEqual(['discord_bot_commands_total', 'discord_bot_commands_total', 'discord_api_requests_total']);
    expect(labels).toEqual(['ping', 'help', 'GET|/api/admin/health|200']);
    expect(values).toEqual([3, 1, 7]);
  });

  test('nothing to save, no query', async () => {
    executeRaw.mockClear();
    await saveDailyMetrics([]);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
