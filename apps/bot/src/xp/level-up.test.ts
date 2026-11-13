import { awardAndAnnounce } from './level-up';
import { grantXp, totalXp } from './grant';
import { isRecalculating } from './recalculate';
import { postLevelUp } from './announce';
import { Logger } from '../utils/logger';

jest.mock('./grant', () => ({ grantXp: jest.fn(), totalXp: jest.fn() }));
jest.mock('./recalculate', () => ({ isRecalculating: jest.fn(() => false), xpLookups: () => ({ isBot: () => false }) }));
jest.mock('./announce', () => ({ postLevelUp: jest.fn(async () => undefined) }));
jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const grant = grantXp as jest.Mock;
const total = totalXp as jest.Mock;
const post = postLevelUp as jest.Mock;

const clientWith = (channelId: string | null) =>
  ({ dataSource: {}, guildConfigs: new Map([['g', { level_up_channel_id: channelId }]]) }) as never;

beforeEach(() => jest.clearAllMocks());

test('the message that crosses level 5 posts it, the next one does not', async () => {
  const client = clientWith('levels');
  // Level 5 starts at 1,000 XP under the default curve
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  total.mockResolvedValueOnce(1001).mockResolvedValueOnce(1003);
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  await awardAndAnnounce(client, 'g', 'm', ['MESSAGE']);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(client, 'g', 'm', 5);
  expect(grant.mock.calls[0][1]).toMatchObject({ guildId: 'g', memberId: 'm', sources: ['MESSAGE'] });
});

test('the grant does not wait for the post, and a failed post is logged', async () => {
  const client = clientWith('levels');
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  total.mockResolvedValue(1001);
  post.mockReturnValueOnce(new Promise(() => undefined));
  await expect(awardAndAnnounce(client, 'g', 'slow', ['MESSAGE'])).resolves.toBeUndefined();

  post.mockRejectedValueOnce(new Error('missing permission'));
  await awardAndAnnounce(client, 'g', 'denied', ['MESSAGE']);
  await new Promise(setImmediate);
  expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('denied'), expect.any(Error));
});

test('a checkpoint graded down (the session closed earlier than it) posts nothing', async () => {
  grant.mockResolvedValue({ rows: 1, xp: -2 });
  total.mockResolvedValue(999);
  await awardAndAnnounce(clientWith('levels'), 'g', 'down', ['VOICE']);
  expect(post).not.toHaveBeenCalled();
});

test('nothing posts without a channel, but the XP is granted', async () => {
  grant.mockResolvedValue({ rows: 1, xp: 2 });
  total.mockResolvedValue(1001);
  await awardAndAnnounce(clientWith(null), 'g', 'm', ['MESSAGE']);
  expect(grant).toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test('nothing is granted or posted while the guild is recalculating', async () => {
  (isRecalculating as jest.Mock).mockReturnValueOnce(true);
  await awardAndAnnounce(clientWith('levels'), 'g', 'm', ['MESSAGE']);
  expect(grant).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test('a failed grant is logged, not thrown', async () => {
  grant.mockRejectedValue(new Error('db down'));
  await expect(awardAndAnnounce(clientWith('levels'), 'g', 'm', ['MESSAGE'])).resolves.toBeUndefined();
});
