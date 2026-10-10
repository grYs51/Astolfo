import ProfileSlash from './profile';
import { InterActionUtils } from '../../utils/interaction-utils';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));

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
      voiceStats: {
        aggregate: jest.fn(async () => ({ _min: { issued_on: null } })),
        findMany: jest.fn(async () => []),
      },
    },
  }) as never;

/** /profile [user] invoked by ME */
const interactionFor = (targetId?: string) =>
  ({
    guildId: 'guild',
    user: { id: ME },
    member: { id: ME },
    options: { get: () => (targetId ? { member: { id: targetId } } : null) },
  }) as never;

const run = (client: never, interaction: never) =>
  (new ProfileSlash() as unknown as {
    slash: (c: never, i: never) => Promise<void>;
  }).slash(client, interaction);

beforeEach(() => jest.clearAllMocks());

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
    expect((client as any).dataSource.voiceStats.findMany).not.toHaveBeenCalled();
  });

  test('your own profile works even when you are hidden', async () => {
    const client = clientWith();
    const asHidden = {
      ...(interactionFor() as object),
      user: { id: HIDDEN },
      member: { id: HIDDEN },
    } as never;
    await run(client, asHidden);

    expect((client as any).dataSource.voiceStats.findMany).toHaveBeenCalled();
    expect(InterActionUtils.send).not.toHaveBeenCalledWith(
      expect.anything(),
      'This member keeps their stats private.',
      true
    );
  });
});
