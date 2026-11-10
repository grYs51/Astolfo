import { diffSettings, parseSettings } from './guildSettings';

jest.mock('../../../../client/instance', () => ({ client: {} }));

const current = {
  prefix: 'astolfo!', // longer than the page allows, set with ,setprefix
  welcome_channel_id: 'voice-1', // not postable, set with ,setwelcomechannel
  welcome_message: '',
  goodbye_message: '',
  toggles: 0b1000, // a bit the page doesn't know
  digest_channel_id: null,
  level_up_channel_id: null,
};

const body = (overrides: Record<string, unknown> = {}) => ({
  prefix: 'astolfo!',
  welcomeChannelId: 'voice-1',
  welcomeMessage: '',
  goodbyeMessage: '',
  digestChannelId: null,
  levelUpChannelId: null,
  toggles: [{ key: 'VOICE_CHANNEL_REMINDER', label: 'ignored', enabled: true }],
  channels: [],
  ...overrides,
});

const parse = (overrides?: Record<string, unknown>) =>
  parseSettings(body(overrides), current, ['general', 'news']);

describe('parseSettings', () => {
  test('maps a valid body onto the config, keeping unknown toggle bits', () => {
    expect(
      parse({ digestChannelId: 'news', welcomeChannelId: 'general', welcomeMessage: 'Hi @member' })
    ).toEqual({
      data: {
        prefix: 'astolfo!',
        welcome_channel_id: 'general',
        welcome_message: 'Hi @member',
        goodbye_message: '',
        toggles: 0b1001,
        digest_channel_id: 'news',
        level_up_channel_id: null,
      },
    });
  });

  test('a level-up channel must be one the bot can post in', () => {
    expect(parse({ levelUpChannelId: 'general' })).toMatchObject({ data: { level_up_channel_id: 'general' } });
    expect(parse({ levelUpChannelId: 'voice-2' })).toEqual({ error: expect.stringContaining('post in that channel') });
    expect(parse({ levelUpChannelId: 12 })).toHaveProperty('error');
    // A page from before levels existed leaves it as it is
    const stored = { ...current, level_up_channel_id: 'news' };
    const { levelUpChannelId: _left, ...old } = body();
    expect(parseSettings(old, stored, [])).toMatchObject({ data: { level_up_channel_id: 'news' } });
  });

  test('a toggle can be switched off', () => {
    const off = parseSettings(
      body({ toggles: [{ key: 'VOICE_CHANNEL_REMINDER', enabled: false }] }),
      { ...current, toggles: 0b1001 },
      []
    );
    expect('data' in off && off.data.toggles).toBe(0b1000);
  });

  test('stored values the page would refuse can be kept', () => {
    expect(parse()).toHaveProperty('data');
  });

  test.each([['a b'], [''], ['sixsix'], [5]])('refuses prefix %p', (prefix) => {
    expect(parse({ prefix })).toEqual({ error: expect.stringContaining('prefix') });
  });

  test('a message of only spaces is empty', () => {
    expect(parse({ goodbyeMessage: '   ' })).toHaveProperty('data.goodbye_message', '');
  });

  test('refuses a message over 200 characters', () => {
    expect(parse({ goodbyeMessage: 'x'.repeat(201) })).toHaveProperty('error');
    expect(
      parse({ welcomeChannelId: 'general', welcomeMessage: 'x'.repeat(200) })
    ).toHaveProperty('data');
  });

  // The bot posts the message there, so it must be a channel the viewer could post in
  test('a message change needs a welcome channel the viewer can post in', () => {
    expect(parse({ welcomeMessage: 'FREE NITRO' })).toEqual({
      error: expect.stringContaining('welcome channel'),
    });
    expect(parse({ goodbyeMessage: 'Bye @member' })).toHaveProperty('error');
    // No welcome channel, nothing posted
    expect(parse({ welcomeChannelId: null, welcomeMessage: 'Hi' })).toHaveProperty('data');
  });

  test('refuses a new channel the bot cannot post in', () => {
    expect(parse({ welcomeChannelId: 'voice-2' })).toHaveProperty('error');
    expect(parse({ digestChannelId: 'voice-1' })).toHaveProperty('error');
    expect(parse({ welcomeChannelId: 42 })).toHaveProperty('error');
  });

  test('null turns a channel off', () => {
    expect(parse({ welcomeChannelId: null })).toHaveProperty('data.welcome_channel_id', null);
  });

  test.each([
    [[{ key: 'toString', enabled: true }]],
    [[{ key: 'NOPE', enabled: true }]],
    [[{ key: 'VOICE_CHANNEL_REMINDER', enabled: 'yes' }]],
    [[null]],
    ['VOICE_CHANNEL_REMINDER'],
  ])('refuses toggles %p', (toggles) => {
    expect(parse({ toggles })).toHaveProperty('error');
  });

  test('refuses a missing body', () => {
    expect(parseSettings(undefined, current, [])).toHaveProperty('error');
  });
});

describe('diffSettings', () => {
  test('lists each changed field and toggle, from and to', () => {
    const after = { ...current, prefix: '?', welcome_channel_id: null, toggles: 0b1001 };
    expect(diffSettings(current, after)).toEqual([
      { field: 'prefix', from: 'astolfo!', to: '?' },
      { field: 'welcomeChannelId', from: 'voice-1', to: null },
      { field: 'toggle:VOICE_CHANNEL_REMINDER', from: false, to: true },
    ]);
  });

  test('nothing changed, nothing to log', () => {
    expect(diffSettings(current, { ...current })).toEqual([]);
  });
});
