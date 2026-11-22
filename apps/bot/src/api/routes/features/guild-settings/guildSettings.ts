import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { guild_configs } from '@prisma/client';
import {
  GuildSettings,
  GuildSettingsHistory,
  LevelRole,
  ServerAccess,
  SettingChange,
  SettingsRole,
} from '@nx-stolfo/api-interfaces';
import { client } from '../../../../client/instance';
import { levelRolesOf, syncGuildLevelRoles } from '../../../../xp/level-roles';
import { Logger } from '../../../../utils/logger';
import { discordDirectory } from '../../../utils/discord-directory';
import { memberOrUnknown } from '../helpers';
import {
  defaultPrefix,
  digestChannelUpdate,
  saveGuildConfig,
} from '../../../../utils/functions/set-config';
import {
  disableFeature,
  enableFeature,
  isEnabled,
  SETTING_FLAGS,
  Settings,
  toggleArray,
} from '../../../../utils/handlers/settings-handler';

type Config = Omit<guild_configs, 'guild_id' | 'digest_last_sent_at'>;
type SettingsBody = Omit<GuildSettings, 'channels' | 'roles' | 'toggles' | 'levelRoles'> & {
  toggles: { key: string; enabled: boolean }[];
};

/** guild_configs.welcome_message / goodbye_message are VarChar(200) */
const MAX_MESSAGE_LENGTH = 200;
const PREFIX = /^\S{1,5}$/;

const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * Validates a PUT body against the stored config. A prefix or channel only
 * has to pass the rules when it changed: the chat commands accept values the
 * page doesn't, and those must not block saving the other fields.
 */
export const parseSettings = (
  body: unknown,
  current: Config,
  postable: string[]
): { error: string } | { data: Config } => {
  const { prefix, welcomeMessage, goodbyeMessage, welcomeChannelId, digestChannelId, toggles, ...rest } =
    (body ?? {}) as Partial<SettingsBody>;
  // A page loaded before levels existed doesn't send it: keep the stored one
  const levelUpChannelId = rest.levelUpChannelId === undefined ? current.level_up_channel_id : rest.levelUpChannelId;

  if (!isString(prefix) || (prefix !== current.prefix && !PREFIX.test(prefix))) {
    return { error: 'The prefix must be 1 to 5 characters, without spaces.' };
  }
  if (
    !isString(welcomeMessage) ||
    !isString(goodbyeMessage) ||
    welcomeMessage.length > MAX_MESSAGE_LENGTH ||
    goodbyeMessage.length > MAX_MESSAGE_LENGTH
  ) {
    return { error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.` };
  }
  for (const [id, stored] of [
    [welcomeChannelId, current.welcome_channel_id],
    [digestChannelId, current.digest_channel_id],
    [levelUpChannelId, current.level_up_channel_id],
  ]) {
    const ok = id === null || id === stored || (isString(id) && postable.includes(id));
    if (!ok) {
      return {
        error: 'I can’t post in that channel. I need View Channel, Send Messages and Embed Links there.',
      };
    }
  }
  const messagesChanged =
    welcomeMessage.trim() !== current.welcome_message ||
    goodbyeMessage.trim() !== current.goodbye_message;
  // The bot posts these words in the welcome channel, so only someone who could post there may write them
  if (messagesChanged && isString(welcomeChannelId) && !postable.includes(welcomeChannelId)) {
    return { error: 'You can’t post in the welcome channel, so you can’t change its messages.' };
  }
  if (!Array.isArray(toggles)) {
    return { error: '`toggles` must be a list.' };
  }

  let bits = current.toggles; // bits the page doesn't know stay as they are
  for (const toggle of toggles) {
    if (!Object.hasOwn(SETTING_FLAGS, toggle?.key) || typeof toggle.enabled !== 'boolean') {
      return { error: `Unknown setting: ${String(toggle?.key)}` };
    }
    const flag = SETTING_FLAGS[toggle.key as Settings];
    bits = toggle.enabled ? enableFeature(bits, flag) : disableFeature(bits, flag);
  }

  return {
    data: {
      prefix,
      welcome_channel_id: welcomeChannelId ?? null,
      // Discord refuses a blank post, so only spaces counts as empty
      welcome_message: welcomeMessage.trim(),
      goodbye_message: goodbyeMessage.trim(),
      toggles: bits,
      digest_channel_id: digestChannelId ?? null,
      level_up_channel_id: levelUpChannelId ?? null,
    },
  };
};

const FIELDS = [
  ['prefix', 'prefix'],
  ['welcomeChannelId', 'welcome_channel_id'],
  ['welcomeMessage', 'welcome_message'],
  ['goodbyeMessage', 'goodbye_message'],
  ['digestChannelId', 'digest_channel_id'],
  ['levelUpChannelId', 'level_up_channel_id'],
] as const;

/** What a save changed, for the audit log; empty when nothing did */
export const diffSettings = (before: Config, after: Config): SettingChange[] => [
  ...FIELDS.filter(([, column]) => before[column] !== after[column]).map(([field, column]) => ({
    field,
    from: before[column],
    to: after[column],
  })),
  ...toggleArray.flatMap(({ key }) => {
    const flag = SETTING_FLAGS[key as Settings];
    const from = isEnabled(before.toggles, flag);
    const to = isEnabled(after.toggles, flag);
    return from === to ? [] : [{ field: `toggle:${key}`, from, to }];
  }),
];

const MAX_LEVEL = 1000;
const MAX_LEVEL_ROLES = 25;
/** Discord's limit for a role name */
const MAX_ROLE_NAME = 100;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Validates the level roles of a PUT body. A reward that isn't stored as it is (new role or new level)
 * needs a role the viewer could hand out themselves, or Manage Server would be a back door to Manage Roles.
 * A row with `newRole` is created on save: the viewer needs to be the owner or have Manage Roles, and the
 * bot Manage Roles. A page from before level roles doesn't send them: the stored ones stay.
 */
export const parseLevelRoles = (
  body: unknown,
  stored: LevelRole[],
  roles: SettingsRole[],
  canCreate: { viewer: boolean; bot: boolean }
): { error: string } | { data: LevelRole[] } => {
  const levelRoles = (body as { levelRoles?: unknown } | undefined)?.levelRoles;
  if (levelRoles === undefined) return { data: stored };
  if (!Array.isArray(levelRoles) || levelRoles.length > MAX_LEVEL_ROLES) {
    return { error: `A server can have up to ${MAX_LEVEL_ROLES} level roles.` };
  }
  const data: LevelRole[] = [];
  for (const entry of levelRoles as (Partial<LevelRole> | null)[]) {
    const level = entry?.level;
    const roleId = entry?.roleId;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      return { error: `Each level role needs a level from 1 to ${MAX_LEVEL} and a role.` };
    }
    if (entry?.newRole !== undefined) {
      const name = isString(entry.newRole?.name) ? entry.newRole.name.trim() : '';
      const color = entry.newRole?.color ?? null;
      if (!name || name.length > MAX_ROLE_NAME) {
        return { error: `A new role needs a name of 1 to ${MAX_ROLE_NAME} characters.` };
      }
      if (color !== null && !(isString(color) && HEX_COLOR.test(color))) {
        return { error: 'A role colour must look like #a1b2c3.' };
      }
      if (!canCreate.viewer) return { error: 'Only the owner or members with Manage Roles can create a role.' };
      if (!canCreate.bot) return { error: 'I need the Manage Roles permission to create a role.' };
      data.push({ level, roleId: '', newRole: { name, color } });
      continue;
    }
    if (!isString(roleId)) {
      return { error: `Each level role needs a level from 1 to ${MAX_LEVEL} and a role.` };
    }
    if (data.some((r) => !r.newRole && r.roleId === roleId)) {
      return { error: 'A role can be the reward for one level only.' };
    }
    const kept = stored.some((r) => r.roleId === roleId && r.level === level);
    if (!kept && !roles.some((r) => r.id === roleId && r.viewerCanAssign)) {
      return { error: 'You can only reward roles you could give out yourself (Manage Roles and a higher role).' };
    }
    data.push({ level, roleId });
  }
  return { data: data.sort((a, b) => a.level - b.level) };
};

/** One audit change per role whose reward level was added, moved or removed */
export const diffLevelRoles = (before: LevelRole[], after: LevelRole[]): SettingChange[] => {
  const levelIn = (list: LevelRole[], roleId: string) => {
    const level = list.find((r) => r.roleId === roleId)?.level;
    return level === undefined ? null : String(level);
  };
  return [...new Set([...before, ...after].map((r) => r.roleId))].flatMap((roleId) => {
    const from = levelIn(before, roleId);
    const to = levelIn(after, roleId);
    return from === to ? [] : [{ field: `levelRole:${roleId}`, from, to }];
  });
};

/** The cached config, or what a guild without a row behaves like */
const loadConfig = (guildId: string): Config =>
  client.guildConfigs.get(guildId) ?? {
    prefix: defaultPrefix(),
    welcome_channel_id: null,
    welcome_message: '',
    goodbye_message: '',
    toggles: 0,
    digest_channel_id: null,
    level_up_channel_id: null,
  };

const toSettings = async (
  guildId: string,
  viewerId: string,
  config: Config,
  levelRoles: LevelRole[]
): Promise<GuildSettings> => {
  const channels = (await discordDirectory().postableChannels(guildId, viewerId)).map(
    ({ id, name }) => ({ id, name, postable: true })
  );
  // A stored channel that's no longer offered still shows, so the form can keep it.
  // No name: the viewer may not be allowed to see it.
  for (const id of new Set([config.welcome_channel_id, config.digest_channel_id, config.level_up_channel_id])) {
    if (id && !channels.some((c) => c.id === id)) {
      channels.push({ id, name: 'current channel (unavailable)', postable: false });
    }
  }
  const [roles, canCreateRoles] = await Promise.all([
    discordDirectory().roles(guildId, viewerId),
    discordDirectory().canCreateRoles(guildId, viewerId),
  ]);
  for (const { roleId: id } of levelRoles) {
    if (!roles.some((r) => r.id === id)) {
      roles.push({ id, name: 'deleted role', color: null, position: -1, botCanAssign: false, viewerCanAssign: false });
    }
  }
  return {
    prefix: config.prefix,
    welcomeChannelId: config.welcome_channel_id,
    welcomeMessage: config.welcome_message,
    goodbyeMessage: config.goodbye_message,
    toggles: toggleArray.map(({ key, label }) => ({
      key,
      label,
      enabled: isEnabled(config.toggles, SETTING_FLAGS[key as Settings]),
    })),
    digestChannelId: config.digest_channel_id,
    levelUpChannelId: config.level_up_channel_id,
    levelRoles,
    channels,
    roles,
    canCreateRoles,
  };
};

/** GET /features/servers/:serverId/settings */
export const getGuildSettings: RequestHandler<{ serverId: string }, GuildSettings> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    res.send(await toSettings(serverId, req.user.id, loadConfig(serverId), await levelRolesOf(req.db, serverId)));
  });

/** PUT /features/servers/:serverId/settings — the whole settings object */
export const setGuildSettings: RequestHandler<
  { serverId: string },
  GuildSettings | { error: string }
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const current = loadConfig(serverId);
  const directory = discordDirectory();
  const [channels, roles, canCreate, storedLevelRoles] = await Promise.all([
    directory.postableChannels(serverId, req.user.id),
    directory.roles(serverId, req.user.id),
    directory.canCreateRoles(serverId, req.user.id),
    levelRolesOf(req.db, serverId),
  ]);

  const parsed = parseSettings(req.body, current, channels.map((c) => c.id));
  if ('error' in parsed) {
    res.status(400).send(parsed);
    return;
  }
  const levelRoles = parseLevelRoles(req.body, storedLevelRoles, roles, canCreate);
  if ('error' in levelRoles) {
    res.status(400).send(levelRoles);
    return;
  }

  // Roles first, then the transaction; a failure deletes the roles this save created, so none are left orphaned
  const createdIds: string[] = [];
  const created: SettingChange[] = [];
  const finalLevelRoles: LevelRole[] = [];
  let saved: Config;
  let levelRoleChanges: SettingChange[];
  try {
    for (const { level, roleId, newRole } of levelRoles.data) {
      if (!newRole) {
        finalLevelRoles.push({ level, roleId });
        continue;
      }
      const id = await directory.createRole(serverId, newRole, `Level ${level} reward, created on the dashboard`);
      createdIds.push(id);
      created.push({ field: `createdRole:${id}`, from: null, to: newRole.name });
      finalLevelRoles.push({ level, roleId: id });
    }

    levelRoleChanges = diffLevelRoles(storedLevelRoles, finalLevelRoles);
    const { digest_channel_id, ...rest } = parsed.data;
    saved = await saveGuildConfig(
      client,
      serverId,
      { ...rest, ...digestChannelUpdate(current, digest_channel_id) },
      { userId: req.user.id, changes: [...diffSettings(current, parsed.data), ...created, ...levelRoleChanges] },
      levelRoleChanges.length ? finalLevelRoles : undefined
    );
  } catch (error) {
    for (const id of createdIds) {
      await directory
        .deleteRole(serverId, id, 'The settings save failed')
        .catch((e) => Logger.warn(`Couldn't delete role ${id} after a failed save in guild ${serverId}`, e));
    }
    throw error;
  }
  // Turning it on, or a new mapping while on, starts the backfill (in the background: member by member under
  // Discord's rate limit). Turning it off leaves the roles members have.
  const wasOn = isEnabled(current.toggles, SETTING_FLAGS.LEVEL_ROLES);
  if (isEnabled(saved.toggles, SETTING_FLAGS.LEVEL_ROLES) && (!wasOn || levelRoleChanges.length)) {
    void syncGuildLevelRoles(client, serverId);
  }
  res.send(await toSettings(serverId, req.user.id, saved, finalLevelRoles));
});

/** GET /features/servers/:serverId/settings/history — the newest 50 page saves */
export const getGuildSettingsHistory: RequestHandler<{ serverId: string }, GuildSettingsHistory> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    const rows = await req.db.settingsChanges.findMany({
      where: { guild_id: serverId },
      orderBy: { at: 'desc' },
      take: 50,
    });
    const members = await discordDirectory().members(serverId, [
      ...new Set(rows.map((r) => r.user_id)),
    ]);
    res.send({
      entries: rows.map((row) => ({
        id: row.id,
        at: row.at,
        member: memberOrUnknown(members, row.user_id),
        changes: row.changes as SettingChange[],
      })),
    });
  });

/**
 * GET /features/servers/:serverId/access — whether the viewer may open the settings page.
 * Members only, but no 403 for non-managers: the detail page asks on every visit.
 */
export const getServerAccess: RequestHandler<{ serverId: string }, ServerAccess> = asyncHandler(
  async (req, res) => {
    res.send({ canManage: await discordDirectory().canManage(req.params.serverId, req.user.id) });
  }
);
