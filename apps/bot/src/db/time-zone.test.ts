import { assertUtcTimeZone } from '.';

const dbIn = (timezone: string) => ({ $queryRaw: jest.fn(async () => [{ timezone }]) }) as never;

describe('assertUtcTimeZone', () => {
  test('passes on UTC', async () => {
    await expect(assertUtcTimeZone(dbIn('UTC'))).resolves.toBeUndefined();
    await expect(assertUtcTimeZone(dbIn('Etc/UTC'))).resolves.toBeUndefined();
  });

  // e.g. a dump restored into a new database on a Europe/Brussels host
  test('refuses any other zone', async () => {
    await expect(assertUtcTimeZone(dbIn('Europe/Brussels'))).rejects.toThrow(/Europe\/Brussels, not UTC/);
  });
});
