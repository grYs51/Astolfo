import { awardAndAnnounce } from './level-up';
import { grantXp, totalXp } from './grant';
import { isRecalculating } from './recalculate';

jest.mock('./grant', () => ({ grantXp: jest.fn(), totalXp: jest.fn() }));
jest.mock('./recalculate', () => ({ isRecalculating: jest.fn(() => false), xpLookups: () => ({ isBot: () => false }) }));
jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const grant = grantXp as jest.Mock;
const total = totalXp as jest.Mock;

const clientWith = (channelId: string | null) => {
  const send = jest.fn();
  const client = {
    dataSource: {},
    guildConfigs: new Map([['g', { level_up_channel_id: channelId }]]),
    channels: { fetch: jest.fn(async () => ({ isSendable: () => true, send })) },
  };
  return { client: client as never, send };
};

beforeEach(() => jest.clearAllMocks());

test('the message that crosses level 5 posts once', async () => {
  const { client, send } = clientWith('levels');
  // Level 5 starts at 1,000 XP under the default curve
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  total.mockResolvedValueOnce(1001).mockResolvedValueOnce(1003);
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toEqual({ content: '🎉 <@m> reached **level 5**!', allowedMentions: { parse: [] } });
  expect(grant.mock.calls[0][1]).toMatchObject({ guildId: 'g', memberId: 'm', sources: ['MESSAGE'] });
});

test('a level seen crossed twice (a live grant and the sweep) posts once', async () => {
  const { client, send } = clientWith('levels');
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  // Both see 999 → 1,001, the crossing into level 5
  total.mockResolvedValue(1001);
  await awardAndAnnounce(client, 'g', 'twice', ['MESSAGE']);
  await awardAndAnnounce(client, 'g', 'twice', ['MESSAGE']);
  expect(send).toHaveBeenCalledTimes(1);
});

test('nothing posts without a channel, but the XP is granted', async () => {
  const { client, send } = clientWith(null);
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  total.mockResolvedValue(1001);
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  expect(grant).toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

test('nothing is granted or posted while the guild is recalculating', async () => {
  (isRecalculating as jest.Mock).mockReturnValueOnce(true);
  const { client, send } = clientWith('levels');
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  expect(grant).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

test('a failed grant is logged, not thrown', async () => {
  const { client } = clientWith('levels');
  grant.mockRejectedValue(new Error('db down'));
  await expect(awardAndAnnounce(client, 'g', 'm', ['MESSAGE'])).resolves.toBeUndefined();
});
