import { schedule5hrVoiceChannelJob } from './voice-channel.scheduler';
import { cardFile } from '../../cards/render';

const mockSend = jest.fn(async (_message: unknown) => undefined);

// Fire the 5h timer straight away
jest.mock('node-schedule', () => ({
  __esModule: true,
  default: { scheduleJob: (_date: Date, callback: () => void) => (callback(), { cancel: jest.fn() }) },
}));
jest.mock('../../client/instance', () => ({
  client: {
    guildConfigs: new Map([['g', { toggles: 0xffff }]]),
    channels: { cache: new Map([['vc', { name: 'chill', isSendable: () => true, send: (message: unknown) => mockSend(message) }]]) },
  },
}));
jest.mock('../logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../cards/render', () => ({ ...jest.requireActual('../../cards/render'), cardFile: jest.fn() }));

const member = {
  id: 'm',
  displayName: 'Astolfo',
  guild: { id: 'g' },
  displayAvatarURL: () => undefined,
  toString: () => '<@m>',
} as never;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => jest.clearAllMocks());

describe('5h voice reminder', () => {
  test('pings with the card', async () => {
    (cardFile as jest.Mock).mockResolvedValue({ name: 'reminder.png' });
    schedule5hrVoiceChannelJob(member, 'vc', new Date());
    await flush();
    expect(mockSend).toHaveBeenCalledWith({ content: '<@m>', files: [{ name: 'reminder.png' }] });
  });

  test('still pings with the text line when the card fails to render', async () => {
    (cardFile as jest.Mock).mockRejectedValue(new Error('no fonts'));
    schedule5hrVoiceChannelJob(member, 'vc', new Date());
    await flush();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(expect.stringMatching(/^<@m> has been in the voice channel for 5 hours (gay|straight)!$/));
  });
});
