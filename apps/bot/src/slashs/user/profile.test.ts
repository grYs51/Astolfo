import ProfileSlash from './profile';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberProfile } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../stats/queries', () => ({ getMemberProfile: jest.fn() }));

const ME = 'me';
const HIDDEN = 'hidden-member';

const clientWith = () =>
  ({
    dataSource: {
      userConfigs: {
        findFirst: jest.fn(async ({ where }: { where: { user_id: string } }) =>
          where.user_id === HIDDEN ? { user_id: HIDDEN } : null
        ),
      },
    },
  }) as never;

/** /profile [user] invoked by ME */
const interactionFor = (targetId?: string) =>
  ({
    guildId: 'guild',
    inCachedGuild: () => true,
    user: { id: ME },
    member: { id: ME },
    options: { get: () => (targetId ? { member: { id: targetId } } : null) },
  }) as never;

const run = (client: never, interaction: never) =>
  (new ProfileSlash() as unknown as {
    slash: (c: never, i: never) => Promise<void>;
  }).slash(client, interaction);

beforeEach(() => {
  jest.clearAllMocks();
  (getMemberProfile as jest.Mock).mockResolvedValue({ sessions: 0, rps: { wins: 0, ties: 0, losses: 0 } });
});

describe('/profile and member privacy', () => {
  test("refuses, privately, to show a hidden member's stats", async () => {
    const client = clientWith();
    await run(client, interactionFor(HIDDEN));

    expect(InterActionUtils.send).toHaveBeenCalledWith(
      expect.anything(),
      'This member keeps their stats private.',
      true // ephemeral: only the asker sees it
    );
    // Their stats are never even queried
    expect(getMemberProfile).not.toHaveBeenCalled();
  });

  test('your own profile works even when you are hidden', async () => {
    const client = clientWith();
    const asHidden = {
      ...(interactionFor() as object),
      user: { id: HIDDEN },
      member: { id: HIDDEN },
    } as never;
    await run(client, asHidden);

    expect(getMemberProfile).toHaveBeenCalledWith(expect.anything(), 'guild', HIDDEN, expect.any(Date));
    expect(InterActionUtils.send).not.toHaveBeenCalledWith(
      expect.anything(),
      'This member keeps their stats private.',
      true
    );
  });
});

test('/profile posts the profile as a PNG card', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue({
    trackingSince: new Date('2026-07-11T00:00:00Z'),
    sessions: 3,
    voiceMs: 3_600_000,
    longestSessionMs: 1_800_000,
    mutedMs: 0,
    streamingMs: 0,
    lastWeekMs: 0,
    rps: { wins: 1, ties: 0, losses: 0 },
  });
  const client = clientWith();
  const interaction = {
    ...(interactionFor() as object),
    guild: { name: 'Paladins', channels: { cache: new Map() } },
    member: { id: ME, displayName: 'Me', displayAvatarURL: () => undefined },
  } as never;
  await run(client, interaction);

  const [, message, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
  expect(message.files[0].name).toBe('profile.png');
  expect(hidden).toBeUndefined(); // public, like before
});
