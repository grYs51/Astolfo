import StatsSlash from './stats';
import DigestSlash from '../guild/digest';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberSummary } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
// No neighbours: the totals section draws without the ranking
jest.mock('../../stats/queries', () => ({ getMemberSummary: jest.fn(), getVoiceNeighbours: jest.fn().mockResolvedValue([]) }));

const interactionWith = (period?: string) =>
  ({
    guild: { id: 'g', name: 'Test', members: { cache: new Map() }, channels: { cache: new Map() } },
    user: { id: 'me', displayName: 'Me', displayAvatarURL: () => undefined },
    options: { get: () => (period ? { value: period } : null) },
  }) as never;

const run = (interaction: never) =>
  (new StatsSlash() as unknown as { slash: (c: never, i: never) => Promise<void> }).slash(
    { dataSource: {} } as never,
    interaction
  );

beforeEach(() => {
  jest.clearAllMocks();
  (getMemberSummary as jest.Mock).mockResolvedValue({
    voiceMs: 0, previousVoiceMs: 0, sessions: 0, messages: 0, previousMessages: 0,
    rankedMembers: 0, companions: [], streak: { current: 0, longest: 0 }, lifetimeMs: 0,
  });
});

describe('/stats', () => {
  test('sends your stats for the past month as a PNG card by default, only to you', async () => {
    await run(interactionWith());
    expect(getMemberSummary).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'month', 'me');
    const [, message, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
    expect(message.embeds).toBeUndefined();
    expect(message.files).toHaveLength(1);
    expect(message.files[0].name).toBe('stats.png');
    expect(hidden).toBe(true);
  });

  test('uses the chosen period', async () => {
    await run(interactionWith('year'));
    expect(getMemberSummary).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'year', 'me');
  });
});

test('slash command definitions pass Discord’s validation', () => {
  // (named dev-stats when DEV is set)
  expect(new StatsSlash().createInteraction().toJSON().name).toMatch(/stats$/);
  const digest = new DigestSlash().createInteraction().toJSON();
  expect(digest.options?.map((o) => o.name)).toEqual(['channel', 'off', 'preview']);
});
