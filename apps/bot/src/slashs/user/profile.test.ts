import ProfileSlash from './profile';
import { InterActionUtils } from '../../utils/interaction-utils';
import { getMemberProfile } from '../../stats/queries';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../stats/queries', () => ({ getMemberProfile: jest.fn() }));

const ME = 'me';

const clientWith = () => ({ dataSource: {} }) as never;

/** /profile [user] invoked by ME */
const interactionFor = (targetId?: string) =>
  ({
    guildId: 'guild',
    inCachedGuild: () => true,
    user: { id: ME },
    member: { id: ME },
    options: {
      getUser: () => (targetId ? { id: targetId } : null),
      getMember: () => (targetId === 'left-server' ? null : targetId ? { id: targetId } : null),
    },
  }) as never;

const run = (client: never, interaction: never) =>
  (new ProfileSlash() as unknown as {
    slash: (c: never, i: never) => Promise<void>;
  }).slash(client, interaction);

beforeEach(() => {
  jest.clearAllMocks();
  (getMemberProfile as jest.Mock).mockResolvedValue({ sessions: 0, rps: { wins: 0, ties: 0, losses: 0 } });
});

test('/profile in a DM answers instead of leaving the reply pending', async () => {
  await run(clientWith(), { ...(interactionFor() as object), inCachedGuild: () => false } as never);

  expect(InterActionUtils.send).toHaveBeenCalledWith(expect.anything(), 'Use /profile in a server.', true);
  expect(getMemberProfile).not.toHaveBeenCalled();
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

test('/profile on someone who left the server says so instead of showing yours', async () => {
  await run(clientWith(), interactionFor('left-server'));

  const [, text, hidden] = (InterActionUtils.send as jest.Mock).mock.calls[0];
  expect(text).toMatch(/isn't a member of this server/);
  expect(hidden).toBe(true);
  expect(getMemberProfile).not.toHaveBeenCalled();
});

test('the user option takes users only (a role used to show your own profile)', () => {
  const json = new ProfileSlash().createInteraction().toJSON();
  // 6 = USER; 9 (MENTIONABLE) also accepts roles
  expect(json.options?.[0]).toMatchObject({ name: 'user', type: 6 });
});
