import { Request, Response } from 'express';
import {
  diffLevelRoles,
  diffSettings,
  parseLevelRoles,
  parseSettings,
  setGuildSettings,
} from './guildSettings';
import { saveGuildConfig } from '../../../../utils/functions/set-config';
import { syncGuildLevelRoles } from '../../../../xp/level-roles';

jest.mock('../../../../client/instance', () => ({ client: { guildConfigs: new Map() } }));
const mockRoles = [
  { id: 'mod', name: 'Moderator', color: null, position: 3, botCanAssign: true, viewerCanAssign: false },
  { id: 'veteran', name: 'Veteran', color: '#9b59b6', position: 2, botCanAssign: false, viewerCanAssign: true },
  { id: 'regular', name: 'Regular', color: null, position: 1, botCanAssign: true, viewerCanAssign: true },
];
jest.mock('../../../utils/discord-directory', () => ({
  discordDirectory: () => ({
    postableChannels: async () => [{ id: 'general', name: 'general', type: 'GuildText' }],
    roles: async () => mockRoles.map((r) => ({ ...r })),
  }),
}));
jest.mock('../../../../xp/level-roles', () => ({
  levelRolesOf: jest.fn(async () => [{ level: 5, roleId: 'regular' }]),
  syncGuildLevelRoles: jest.fn(async () => undefined),
}));
jest.mock('../../../../utils/functions/set-config', () => ({
  ...jest.requireActual('../../../../utils/functions/set-config'),
  saveGuildConfig: jest.fn(async (_client: unknown, _id: string, data: object) => ({
    prefix: ',',
    welcome_channel_id: null,
    welcome_message: '',
    goodbye_message: '',
    toggles: 0,
    digest_channel_id: null,
    level_up_channel_id: null,
    ...data,
  })),
}));

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

describe('parseLevelRoles', () => {
  const stored = [{ level: 10, roleId: 'mod' }];
  const parseRoles = (levelRoles: unknown) => parseLevelRoles({ levelRoles }, stored, mockRoles);

  test('sorts by level and keeps a stored reward the viewer could not add', () => {
    expect(
      parseRoles([
        { level: 20, roleId: 'veteran' },
        { level: 10, roleId: 'mod' },
        { level: 5, roleId: 'regular' },
      ])
    ).toEqual({
      data: [
        { level: 5, roleId: 'regular' },
        { level: 10, roleId: 'mod' },
        { level: 20, roleId: 'veteran' },
      ],
    });
  });

  // Manage Server must not be a way round Manage Roles
  test('a new or moved reward needs a role the viewer could give out', () => {
    expect(parseRoles([{ level: 1, roleId: 'mod' }])).toEqual({ error: expect.stringContaining('give out yourself') });
    expect(parseRoles([{ level: 3, roleId: 'unknown' }])).toHaveProperty('error');
  });

  test('a role the bot cannot hand out can still be saved (the page warns)', () => {
    expect(parseRoles([{ level: 20, roleId: 'veteran' }])).toHaveProperty('data');
  });

  test.each([
    [[{ level: 0, roleId: 'regular' }]],
    [[{ level: 1.5, roleId: 'regular' }]],
    [[{ level: '5', roleId: 'regular' }]],
    [[{ level: 1001, roleId: 'regular' }]],
    [[{ level: 5 }]],
    [[null]],
    [[{ level: 5, roleId: 'regular' }, { level: 6, roleId: 'regular' }]],
    [Array.from({ length: 26 }, () => ({ level: 5, roleId: 'regular' }))],
    ['regular'],
  ])('refuses %p', (levelRoles) => {
    expect(parseRoles(levelRoles)).toHaveProperty('error');
  });

  test('a page from before level roles keeps the stored ones', () => {
    expect(parseLevelRoles({}, stored, [])).toEqual({ data: stored });
  });
});

describe('diffLevelRoles', () => {
  test('one change per added, moved or removed role', () => {
    const before = [
      { level: 5, roleId: 'regular' },
      { level: 20, roleId: 'veteran' },
      { level: 30, roleId: 'old' },
    ];
    const after = [
      { level: 5, roleId: 'regular' },
      { level: 25, roleId: 'veteran' },
      { level: 50, roleId: 'legend' },
    ];
    expect(diffLevelRoles(before, after)).toEqual([
      { field: 'levelRole:veteran', from: '20', to: '25' },
      { field: 'levelRole:old', from: '30', to: null },
      { field: 'levelRole:legend', from: null, to: '50' },
    ]);
  });
});

describe('setGuildSettings level roles', () => {
  const save = saveGuildConfig as jest.Mock;
  const sync = syncGuildLevelRoles as jest.Mock;

  const put = async (levelRoles?: unknown) => {
    const res = { send: jest.fn(), status: jest.fn().mockReturnThis() };
    const req = {
      params: { serverId: 'g' },
      user: { id: 'viewer' },
      db: {},
      body: { ...body({ prefix: ',', welcomeChannelId: null }), levelRoles },
    };
    await (setGuildSettings as unknown as (req: Request, res: Response, next: jest.Mock) => Promise<void>)(
      req as unknown as Request,
      res as unknown as Response,
      jest.fn()
    );
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  test('saves a new reward with its audit entry and starts the backfill', async () => {
    const levelRoles = [
      { level: 5, roleId: 'regular' },
      { level: 20, roleId: 'veteran' },
    ];
    const res = await put(levelRoles);
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      'g',
      expect.anything(),
      { userId: 'viewer', changes: expect.arrayContaining([{ field: 'levelRole:veteran', from: null, to: '20' }]) },
      levelRoles
    );
    expect(sync).toHaveBeenCalledWith(expect.anything(), 'g');
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        levelRoles,
        roles: expect.arrayContaining([expect.objectContaining({ id: 'veteran', botCanAssign: false })]),
      })
    );
  });

  test('unchanged rewards are not rewritten and start no backfill', async () => {
    await put([{ level: 5, roleId: 'regular' }]);
    expect(save).toHaveBeenCalled();
    expect(save.mock.calls[0][4]).toBeUndefined();
    expect(sync).not.toHaveBeenCalled();
  });

  test('a role the viewer could not give out is refused and nothing is saved', async () => {
    const res = await put([{ level: 1, roleId: 'mod' }]);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });
});
