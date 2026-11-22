import { rolesToSync, syncMemberLevelRoles } from './level-roles';
import { Logger } from '../utils/logger';

jest.mock('../api/utils/discord-directory', () => ({ discordDirectory: () => ({}) }));
jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mapping = [
  { level: 5, roleId: 'regular' },
  { level: 20, roleId: 'veteran' },
  { level: 20, roleId: 'veteran-color' },
];
const held = (...ids: string[]) => new Set(ids);

describe('rolesToSync', () => {
  test('rewards stack: every role at or below the level', () => {
    expect(rolesToSync(mapping, 25, held())).toEqual({ add: ['regular', 'veteran', 'veteran-color'], remove: [] });
    expect(rolesToSync(mapping, 20, held('regular'))).toEqual({ add: ['veteran', 'veteran-color'], remove: [] });
  });

  test('roles above the level come off, roles outside the mapping stay', () => {
    expect(rolesToSync(mapping, 5, held('regular', 'veteran', 'moderator'))).toEqual({ add: [], remove: ['veteran'] });
    expect(rolesToSync(mapping, 0, held('regular'))).toEqual({ add: [], remove: ['regular'] });
  });

  test('a member already in line needs nothing (idempotent)', () => {
    expect(rolesToSync(mapping, 7, held('regular'))).toEqual({ add: [], remove: [] });
    expect(rolesToSync([], 50, held('regular'))).toEqual({ add: [], remove: [] });
  });
});

describe('syncMemberLevelRoles', () => {
  const add = jest.fn();
  const remove = jest.fn();
  const clientWith = (editable: Record<string, boolean>) => {
    const guild = {
      roles: { cache: new Map(Object.entries(editable).map(([id, e]) => [id, { editable: e }])) },
      members: { fetch: jest.fn() },
    };
    const member = { id: 'm', guild, roles: { cache: held('veteran', 'veteran-color'), add, remove } };
    guild.members.fetch.mockResolvedValue(member);
    const findMany = jest.fn(async () => mapping.map((r) => ({ guild_id: 'g', role_id: r.roleId, level: r.level })));
    return { guilds: { cache: new Map([['g', guild]]) }, dataSource: { levelRoles: { findMany } } } as never;
  };

  beforeEach(() => jest.clearAllMocks());

  test('hands out what the bot may and warns about the rest instead of throwing', async () => {
    // veteran-color sits above the bot's highest role
    await syncMemberLevelRoles(clientWith({ regular: true, veteran: true, 'veteran-color': false }), 'g', 'm', 5);
    expect(add).toHaveBeenCalledWith(['regular'], expect.any(String));
    expect(remove).toHaveBeenCalledWith(['veteran'], expect.any(String));
    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('veteran-color'));
  });

  test('without Manage Roles nothing is requested', async () => {
    await syncMemberLevelRoles(clientWith({ regular: false, veteran: false, 'veteran-color': false }), 'g', 'm', 5);
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });
});
