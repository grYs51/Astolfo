import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { guild_configs } from '@prisma/client';
import {
  GuildSettings,
  GuildSettingsHistory,
  ServerAccess,
  SettingChange,
} from '@nx-stolfo/api-interfaces';
import { client } from '../../../../client/instance';
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
type SettingsBody = Omit<GuildSettings, 'channels' | 'toggles'> & {
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
  const { prefix, welcomeMessage, goodbyeMessage, welcomeChannelId, digestChannelId, toggles } =
    (body ?? {}) as Partial<SettingsBody>;

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
    },
  };
};

const FIELDS = [
  ['prefix', 'prefix'],
  ['welcomeChannelId', 'welcome_channel_id'],
  ['welcomeMessage', 'welcome_message'],
  ['goodbyeMessage', 'goodbye_message'],
  ['digestChannelId', 'digest_channel_id'],
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

/** The cached config, or what a guild without a row behaves like */
const loadConfig = (guildId: string): Config =>
  client.guildConfigs.get(guildId) ?? {
    prefix: defaultPrefix(),
    welcome_channel_id: null,
    welcome_message: '',
    goodbye_message: '',
    toggles: 0,
    digest_channel_id: null,
  };

const toSettings = async (
  guildId: string,
  viewerId: string,
  config: Config
): Promise<GuildSettings> => {
  const channels = (await discordDirectory().postableChannels(guildId, viewerId)).map(
    ({ id, name }) => ({ id, name, postable: true })
  );
  // A stored channel that's no longer offered still shows, so the form can keep it.
  // No name: the viewer may not be allowed to see it.
  for (const id of new Set([config.welcome_channel_id, config.digest_channel_id])) {
    if (id && !channels.some((c) => c.id === id)) {
      channels.push({ id, name: 'current channel (unavailable)', postable: false });
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
    channels,
  };
};

/** GET /features/servers/:serverId/settings */
export const getGuildSettings: RequestHandler<{ serverId: string }, GuildSettings> =
  asyncHandler(async (req, res) => {
    const { serverId } = req.params;
    res.send(await toSettings(serverId, req.user.id, loadConfig(serverId)));
  });

/** PUT /features/servers/:serverId/settings — the whole settings object */
export const setGuildSettings: RequestHandler<
  { serverId: string },
  GuildSettings | { error: string }
> = asyncHandler(async (req, res) => {
  const { serverId } = req.params;
  const current = loadConfig(serverId);
  const postable = (await discordDirectory().postableChannels(serverId, req.user.id)).map(
    (c) => c.id
  );

  const parsed = parseSettings(req.body, current, postable);
  if ('error' in parsed) {
    res.status(400).send(parsed);
    return;
  }

  const { digest_channel_id, ...rest } = parsed.data;
  const saved = await saveGuildConfig(
    client,
    serverId,
    { ...rest, ...digestChannelUpdate(current, digest_channel_id) },
    { userId: req.user.id, changes: diffSettings(current, parsed.data) }
  );
  res.send(await toSettings(serverId, req.user.id, saved));
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
