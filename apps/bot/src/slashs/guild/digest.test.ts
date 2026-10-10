import DigestSlash from './digest';
import { InterActionUtils } from '../../utils/interaction-utils';
import { buildLatestDigest } from '../../utils/schedulers/digest.scheduler';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn() },
}));
jest.mock('../../utils/schedulers/digest.scheduler', () => ({
  buildLatestDigest: jest.fn(),
}));

const setup = (opts: { canPost?: boolean; current?: string | null } = {}) => {
  const upsert = jest.fn(async ({ create }) => create);
  const client = {
    guildConfigs: new Map([['g', { guild_id: 'g', digest_channel_id: opts.current ?? null }]]),
    dataSource: { guildConfigurations: { upsert } },
  };
  const interactionFor = (subcommand: string) => ({
    isChatInputCommand: () => true,
    guild: {
      id: 'g',
      members: { me: { id: 'bot' } },
      channels: {
        fetch: jest.fn(async (id: string) => ({
          id,
          permissionsFor: () => ({ has: () => opts.canPost ?? true }),
        })),
      },
    },
    options: {
      getSubcommand: () => subcommand,
      getChannel: () => ({ id: 'recap' }),
    },
  });
  const run = (subcommand: string) =>
    (new DigestSlash() as unknown as { slash: (c: never, i: never) => Promise<void> }).slash(
      client as never,
      interactionFor(subcommand) as never
    );
  return { client, upsert, run };
};

const reply = () => (InterActionUtils.send as jest.Mock).mock.calls[0][1];

beforeEach(() => jest.clearAllMocks());

describe('/digest', () => {
  test('turning it on saves the channel and starts with next week', async () => {
    const { client, upsert, run } = setup();
    await run('channel');

    const data = upsert.mock.calls[0][0].update;
    expect(data.digest_channel_id).toBe('recap');
    // Stamped, so the first post is next Monday rather than a catch-up now
    expect(data.digest_last_sent_at).toBeInstanceOf(Date);
    expect(client.guildConfigs.get('g')).toMatchObject({ digest_channel_id: 'recap' });
    expect(reply()).toContain('<#recap>');
  });

  test('moving it to another channel keeps the schedule', async () => {
    const { upsert, run } = setup({ current: 'old' });
    await run('channel');
    expect(upsert.mock.calls[0][0].update).toEqual({ digest_channel_id: 'recap' });
  });

  test('refuses a channel the bot cannot post in', async () => {
    const { upsert, run } = setup({ canPost: false });
    await run('channel');
    expect(upsert).not.toHaveBeenCalled();
    expect(reply()).toContain('I can’t post in <#recap>');
  });

  test('off clears the channel', async () => {
    const { upsert, run } = setup({ current: 'recap' });
    await run('off');
    expect(upsert.mock.calls[0][0].update).toEqual({ digest_channel_id: null });
  });

  test('preview of a quiet week says so, privately', async () => {
    (buildLatestDigest as jest.Mock).mockResolvedValue(undefined);
    const { run } = setup();
    await run('preview');
    expect(reply()).toContain('Nothing happened last week');
    expect((InterActionUtils.send as jest.Mock).mock.calls[0][2]).toBe(true);
  });
});
