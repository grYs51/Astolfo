import { checkpointXp } from './checkpoint';
import { awardAndAnnounce, VOICE_SOURCES } from './level-up';
import { isXpBusy } from './recalculate';

jest.mock('./level-up', () => ({ VOICE_SOURCES: ['VOICE'], awardAndAnnounce: jest.fn(async () => undefined) }));
jest.mock('./recalculate', () => ({ isXpBusy: jest.fn((guildId: string) => guildId === 'busy') }));
jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const award = awardAndAnnounce as jest.Mock;

const clientWith = (open: { guild_id: string; member_id: string }[]) =>
  ({ dataSource: { $queryRaw: jest.fn(async () => open) } }) as never;

beforeEach(() => jest.clearAllMocks());

test('grades every member still in voice, skipping a guild a sweep or recalculation holds', async () => {
  const client = clientWith([
    { guild_id: 'g', member_id: 'a' },
    { guild_id: 'busy', member_id: 'b' },
    { guild_id: 'g', member_id: 'c' },
  ]);
  await checkpointXp(client);
  expect(award.mock.calls).toEqual([
    [client, 'g', 'a', VOICE_SOURCES],
    [client, 'g', 'c', VOICE_SOURCES],
  ]);
  expect(isXpBusy).toHaveBeenCalledWith('busy');
});

test('a tick still running makes the next one do nothing', async () => {
  let finish = () => undefined as void;
  award.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
  const client = clientWith([{ guild_id: 'g', member_id: 'a' }]);
  const first = checkpointXp(client);
  await checkpointXp(client);
  // Let the first tick reach its award, then end it
  await new Promise((resolve) => setImmediate(resolve));
  finish();
  await first;
  expect(award).toHaveBeenCalledTimes(1);
});
