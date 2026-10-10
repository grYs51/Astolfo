import { digestWeek, isDigestDue, lastDigestMoment, runDueDigests } from './digest.scheduler';
import { getServerDigest } from '../../stats/queries';

jest.mock('../../stats/queries', () => ({ getServerDigest: jest.fn() }));
jest.mock('../logger', () => ({ Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const at = (iso: string) => new Date(iso);
const H = 60 * 60 * 1000;

describe('digest timing (Mondays 08:00 UTC)', () => {
  test.each([
    ['2026-10-05T08:00:00Z', '2026-10-05T08:00:00.000Z'], // Monday, on the dot
    ['2026-10-05T07:59:00Z', '2026-09-28T08:00:00.000Z'], // Monday, just before
    ['2026-10-10T12:00:00Z', '2026-10-05T08:00:00.000Z'], // Saturday
    ['2026-10-11T23:59:00Z', '2026-10-05T08:00:00.000Z'], // Sunday night
  ])('last digest moment before %s is %s', (now, expected) => {
    expect(lastDigestMoment(at(now)).toISOString()).toBe(expected);
  });

  test('covers the full Monday–Sunday week before the post', () => {
    const week = digestWeek(at('2026-10-05T09:00:00Z'));
    expect(week.from.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(week.to.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  test('due once per week', () => {
    const monday = at('2026-10-05T08:05:00Z');
    expect(isDigestDue(null, monday)).toBe(true);
    expect(isDigestDue(at('2026-09-28T08:05:00Z'), monday)).toBe(true); // last week's post
    expect(isDigestDue(at('2026-10-05T08:05:00Z'), at('2026-10-05T09:05:00Z'))).toBe(false); // already posted
    // Turned on mid-week (/digest stamps "now"): first post is next Monday
    expect(isDigestDue(at('2026-10-07T15:00:00Z'), at('2026-10-08T10:00:00Z'))).toBe(false);
  });
});

describe('runDueDigests', () => {
  const NOW = at('2026-10-05T08:05:00Z');
  const activeWeek = {
    voiceMs: 3 * H, previousVoiceMs: H, messages: 4, previousMessages: 2, activeMembers: 2,
    topVoice: [], topMessages: [], bestDuo: undefined, busiestDay: undefined,
  };

  const clientWith = (opts: { lastSent?: Date | null; inGuild?: boolean; sendable?: boolean } = {}) => {
    const send = jest.fn();
    const update = jest.fn(async ({ where, data }) => ({ guild_id: where.guild_id, ...data }));
    const client = {
      dataSource: {
        guildConfigurations: {
          findMany: jest.fn(async () => [
            { guild_id: 'g', digest_channel_id: 'chan', digest_last_sent_at: opts.lastSent ?? null },
          ]),
          update,
        },
      },
      guilds: { cache: new Map(opts.inGuild === false ? [] : [['g', { name: 'Test' }]]) },
      channels: {
        fetch: jest.fn(async () =>
          opts.sendable === false ? null : { isSendable: () => true, send }
        ),
      },
      guildConfigs: new Map(),
    };
    return { client: client as never, send, update };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerDigest as jest.Mock).mockResolvedValue(activeWeek);
  });

  test('posts the digest for last week and stamps the guild', async () => {
    const { client, send, update } = clientWith();
    expect(await runDueDigests(client, NOW)).toEqual(['g']);

    expect(getServerDigest).toHaveBeenCalledWith(
      expect.anything(),
      'g',
      { from: at('2026-09-28T00:00:00Z'), to: at('2026-10-05T00:00:00Z') },
      { from: at('2026-09-21T00:00:00Z'), to: at('2026-09-28T00:00:00Z') }
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { guild_id: 'g' }, data: { digest_last_sent_at: NOW } });
  });

  test('does not post twice in a week', async () => {
    const { client, send } = clientWith({ lastSent: at('2026-10-05T08:05:00Z') });
    expect(await runDueDigests(client, at('2026-10-05T09:05:00Z'))).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  test('a silent week posts nothing but still counts as done', async () => {
    (getServerDigest as jest.Mock).mockResolvedValue({ ...activeWeek, voiceMs: 0, messages: 0 });
    const { client, send, update } = clientWith();
    expect(await runDueDigests(client, NOW)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  test('a deleted channel is stamped too, so it is not retried every hour', async () => {
    const { client, update } = clientWith({ sendable: false });
    expect(await runDueDigests(client, NOW)).toEqual([]);
    expect(update).toHaveBeenCalled();
  });

  test('skips servers the bot has left', async () => {
    const { client, update } = clientWith({ inGuild: false });
    expect(await runDueDigests(client, NOW)).toEqual([]);
    expect(getServerDigest).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
