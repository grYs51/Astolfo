import DuoSlash from './duo';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getDuo } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../stats/queries', () => ({ getDuo: jest.fn() }));

const ME = 'me';
const HIDDEN = 'hidden-member';

const client = {
  dataSource: {
    userConfigs: {
      findFirst: jest.fn(async ({ where }: { where: { user_id: string } }) =>
        where.user_id === HIDDEN ? { user_id: HIDDEN } : null
      ),
    },
  },
} as never;

const member = (id: string) => [id, { displayName: id, displayAvatarURL: () => undefined }] as const;

/** /duo member:<other> [period] invoked by ME */
const interactionWith = (other: { id: string; bot?: boolean }, period?: string) =>
  ({
    inCachedGuild: () => true,
    guild: {
      id: 'g',
      name: 'Paladins',
      members: { cache: new Map([member(ME), member('friend')]) },
      channels: { cache: new Map([['vc1', { name: 'round-table' }]]) },
    },
    user: { id: ME },
    options: {
      getUser: () => ({ bot: false, ...other }),
      get: () => (period ? { value: period } : null),
    },
  }) as never;

const run = (interaction: never) =>
  (new DuoSlash() as unknown as { slash: (c: never, i: never) => Promise<void> }).slash(client, interaction);

const refused = (message: string) =>
  expect(InterActionUtils.send).toHaveBeenCalledWith(expect.anything(), message, true);

beforeEach(() => {
  jest.clearAllMocks();
  (getDuo as jest.Mock).mockResolvedValue({ togetherMs: 3_600_000, aVoiceMs: 7_200_000, bVoiceMs: 3_600_000, topChannelId: 'vc1' });
});

describe('/duo', () => {
  test('posts the duo card for the past month, publicly', async () => {
    await run(interactionWith({ id: 'friend' }));
    expect(getDuo).toHaveBeenCalledWith(expect.anything(), 'g', ME, 'friend', 'month');
    const [, message, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
    expect(message.files[0].name).toBe('duo.png');
    expect(hidden).toBeUndefined();
  });

  test('uses the chosen period', async () => {
    await run(interactionWith({ id: 'friend' }, 'all'));
    expect(getDuo).toHaveBeenCalledWith(expect.anything(), 'g', ME, 'friend', 'all');
  });

  test.each([
    ['a hidden member', { id: HIDDEN }, 'This member keeps their stats private.'],
    ['yourself', { id: ME }, 'Pick another member (not yourself or a bot).'],
    ['a bot', { id: 'bot', bot: true }, 'Pick another member (not yourself or a bot).'],
  ])('refuses, privately, %s', async (_, other, message) => {
    await run(interactionWith(other));
    refused(message);
    expect(getDuo).not.toHaveBeenCalled();
  });

  test('in a DM answers instead of leaving the reply pending', async () => {
    await run({ ...(interactionWith({ id: 'friend' }) as object), inCachedGuild: () => false } as never);
    refused('Use /duo in a server.');
    expect(getDuo).not.toHaveBeenCalled();
  });
});

test('slash command definition passes Discord’s validation', () => {
  const duo = new DuoSlash().createInteraction().toJSON();
  expect(duo.name).toMatch(/duo$/);
  expect(duo.options?.map((o) => o.name)).toEqual(['member', 'period']);
});
