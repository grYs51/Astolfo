import { postLevelUp } from './announce';
import { cardFile } from '../cards/render';

jest.mock('../cards/render', () => ({ ...jest.requireActual('../cards/render'), cardFile: jest.fn() }));
jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const card = cardFile as jest.Mock;
const LINE = (id: string) => `🎉 <@${id}> reached **level 5**!`;

const clientWith = (channelId: string | null) => {
  const send = jest.fn();
  const client = {
    guildConfigs: new Map([['g', { level_up_channel_id: channelId }]]),
    guilds: { cache: new Map() },
    channels: { fetch: jest.fn(async () => ({ isSendable: () => true, send })) },
  };
  return { client: client as never, send };
};

beforeEach(() => {
  jest.clearAllMocks();
  card.mockImplementation(async (_svg: string, name: string) => ({ name }));
});

test('posts the card with the line beside it, without pinging', async () => {
  const { client, send } = clientWith('levels');
  await postLevelUp(client, 'g', 'm', 5);
  expect(send).toHaveBeenCalledWith({ content: LINE('m'), files: [{ name: 'level-up.png' }], allowedMentions: { parse: [] } });
});

test('a level seen crossed twice (a live grant and the sweep) posts once, even when both start together', async () => {
  const { client, send } = clientWith('levels');
  await Promise.all([postLevelUp(client, 'g', 'twice', 5), postLevelUp(client, 'g', 'twice', 5)]);
  expect(send).toHaveBeenCalledTimes(1);
});

test('a card that fails to render still posts the line', async () => {
  const { client, send } = clientWith('levels');
  card.mockRejectedValueOnce(new Error('resvg'));
  await postLevelUp(client, 'g', 'fallback', 5);
  expect(send).toHaveBeenCalledWith({ content: LINE('fallback'), files: [], allowedMentions: { parse: [] } });
});

test('nothing posts without a channel', async () => {
  const { client, send } = clientWith(null);
  await postLevelUp(client, 'g', 'm', 5);
  expect(send).not.toHaveBeenCalled();
});
