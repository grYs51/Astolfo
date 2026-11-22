import WrappedSlash from './wrapped';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberWrapped } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({ InterActionUtils: { send: jest.fn() } }));
jest.mock('../../stats/queries', () => ({ getMemberWrapped: jest.fn() }));
jest.mock('../../api/utils/discord-directory', () => ({ discordDirectory: () => ({ botIds: () => ['music-bot'] }) }));

const me = { id: 'me', displayName: 'Me', user: { bot: false }, displayAvatarURL: () => undefined };

/** /wrapped [year] invoked by me */
const interactionFor = (year: number | null) =>
  ({
    inCachedGuild: () => true,
    member: me,
    guild: { id: 'guild', name: 'Paladins', channels: { cache: new Map() }, members: { cache: new Map([['me', me]]) } },
    options: { getUser: () => null, getMember: () => null, getInteger: () => year },
  }) as never;

const run = (interaction: never) =>
  (new WrappedSlash() as unknown as { slash: (c: never, i: never) => Promise<void> }).slash({ dataSource: {} } as never, interaction);

const quiet = {
  year: 2025,
  voiceMs: 0,
  sessions: 0,
  longestSessionMs: 0,
  topChannels: [],
  buddies: [],
  months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, voiceMs: 0, messages: 0 })),
  peakMonth: null,
  hours: Array(24).fill(0),
  persona: null,
  days: { start: '2025-01-01', end: '2025-12-31', days: [] },
  longestStreak: 0,
  milestones: [],
  messages: 0,
  voiceRank: null,
  xp: { gained: 0, levelFrom: 0, levelTo: 0 },
  games: { rockPaperScissors: 0, ticTacToe: 0, trivia: 0 },
};

beforeEach(() => jest.clearAllMocks());

test('a future year is refused without a query', async () => {
  await run(interactionFor(new Date().getUTCFullYear() + 1));
  const [, text, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
  expect(text).toMatch(/hasn't happened yet/);
  expect(hidden).toBe(true);
  expect(getMemberWrapped).not.toHaveBeenCalled();
});

test('a year with nothing in it says so, only to you', async () => {
  (getMemberWrapped as jest.Mock).mockResolvedValue(quiet);
  await run(interactionFor(2025));
  // UTC (no tz) and without the server's bots
  expect(getMemberWrapped).toHaveBeenCalledWith({}, 'guild', 'me', 2025, { now: expect.any(Date), botIds: ['music-bot'] });
  const [, text, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
  expect(text).toMatch(/Nothing to wrap/);
  expect(hidden).toBe(true);
});

test('posts the year as a PNG card, the current year by default', async () => {
  (getMemberWrapped as jest.Mock).mockResolvedValue({ ...quiet, year: new Date().getUTCFullYear(), voiceMs: 3_600_000, sessions: 2 });
  await run(interactionFor(null));
  expect((getMemberWrapped as jest.Mock).mock.calls[0][3]).toBe(new Date().getUTCFullYear());
  const [, message, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
  expect(message.files[0].name).toBe(`wrapped-${new Date().getUTCFullYear()}.png`);
  expect(hidden).toBeUndefined();
});
