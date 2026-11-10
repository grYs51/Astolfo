import DuoSlash from './duo';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getDuo } from '../../stats/queries';
import { duoCard } from '../../cards/duo.card';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../stats/queries', () => ({ getDuo: jest.fn() }));
jest.mock('../../cards/duo.card', () => {
  const actual = jest.requireActual('../../cards/duo.card');
  return { ...actual, duoCard: jest.fn(actual.duoCard) };
});

const ME = 'me';

const client = { dataSource: {} } as never;

const member = (id: string) => [id, { displayName: id, displayAvatarURL: () => undefined }] as const;

const EVERYONE = { id: 'everyone-role' };
/** A voice channel; `open` = @everyone may view it */
const channel = (name: string, open: boolean) => ({
  name,
  permissionsFor: (role: unknown) => ({ has: (perm: string) => role === EVERYONE && perm === 'ViewChannel' && open }),
});

/** /duo member:<other> [period] invoked by ME; other = null when they're not in the server */
const interactionWith = (other: { id: string; bot?: boolean } | null, period?: string) =>
  ({
    inCachedGuild: () => true,
    guild: {
      id: 'g',
      name: 'Paladins',
      roles: { everyone: EVERYONE },
      members: { cache: new Map([member(ME), member('friend')]) },
      channels: { cache: new Map([['vc1', channel('round-table', true)], ['staff', channel('staff-room', false)]]) },
    },
    user: { id: ME },
    options: {
      getMember: () => (other ? { id: other.id, user: { bot: other.bot ?? false } } : null),
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

  test.each([
    ['names a channel everyone can see', 'vc1', 'round-table'],
    ['leaves out a channel @everyone can’t see', 'staff', undefined],
  ])('%s', async (_, topChannelId, topChannelName) => {
    (getDuo as jest.Mock).mockResolvedValue({ togetherMs: 1, aVoiceMs: 1, bVoiceMs: 1, topChannelId });
    await run(interactionWith({ id: 'friend' }));
    expect((duoCard as jest.Mock).mock.calls[0][0].topChannelName).toBe(topChannelName);
  });

  test('uses the chosen period', async () => {
    await run(interactionWith({ id: 'friend' }, 'all'));
    expect(getDuo).toHaveBeenCalledWith(expect.anything(), 'g', ME, 'friend', 'all');
  });

  test.each([
    ['yourself', { id: ME }, 'Pick another member of this server (not yourself or a bot).'],
    ['a bot', { id: 'bot', bot: true }, 'Pick another member of this server (not yourself or a bot).'],
    ['someone who left the server', null, 'Pick another member of this server (not yourself or a bot).'],
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
