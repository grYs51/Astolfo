import StatsSlash from './stats';
import DigestSlash from '../guild/digest';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberSummary } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../stats/queries', () => ({ getMemberSummary: jest.fn() }));

const interactionWith = (period?: string) =>
  ({
    guild: { id: 'g', name: 'Test' },
    user: { id: 'me' },
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
    rankedMembers: 0, companions: [],
  });
});

describe('/stats', () => {
  test('shows your own stats for the past month by default, only to you', async () => {
    await run(interactionWith());
    expect(getMemberSummary).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'month');
    const [, message, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
    expect(message.embeds).toHaveLength(1);
    expect(hidden).toBe(true);
  });

  test('uses the chosen period', async () => {
    await run(interactionWith('year'));
    expect(getMemberSummary).toHaveBeenCalledWith(expect.anything(), 'g', 'me', 'year');
  });
});

test('slash command definitions pass Discord’s validation', () => {
  // (named dev-stats when DEV is set)
  expect(new StatsSlash().createInteraction().toJSON().name).toMatch(/stats$/);
  const digest = new DigestSlash().createInteraction().toJSON();
  expect(digest.options?.map((o) => o.name)).toEqual(['channel', 'off', 'preview']);
});
