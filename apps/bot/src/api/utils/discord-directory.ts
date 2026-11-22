import {
  ChannelType,
  DiscordAPIError,
  GuildMember,
  NewsChannel,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  Role,
  TextChannel,
} from 'discord.js';
import type { SettingsRole } from '@nx-stolfo/api-interfaces';
import { client } from '../../client/instance';
import { Logger } from '../../utils/logger';
import { ServiceUnavailable } from './http-errors';
import {
  defaultAvatarUrl,
  findMockGuild,
  isMockDiscord,
  MOCK_GUILDS,
} from '../../dev/mock-discord';

export type ChannelInfo = { id: string; name: string; type: string };

/** What the bot needs in a channel to post there (digest, welcome, goodbye) */
export const POST_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
];

export type MemberInfo = {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
};

/**
 * Everything the API looks up on Discord, behind one interface so the
 * dashboard can run against fixtures (MOCK_DISCORD) as well as the live
 * gateway cache.
 */
export type GuildInfo = {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  joinedAt: Date | null;
};

export interface DiscordDirectory {
  /** Every server the bot is in */
  guilds(): GuildInfo[];
  isMember(guildId: string, userId: string): Promise<boolean>;
  /** Manage Server (also true for Administrator and the owner) */
  canManage(guildId: string, userId: string): Promise<boolean>;
  guild(guildId: string): { name: string; icon: string | null } | undefined;
  channel(guildId: string, channelId: string): ChannelInfo | undefined;
  members(guildId: string, userIds: string[]): Promise<Map<string, MemberInfo>>;
  /** Ids of the guild's current human members */
  memberIds(guildId: string): Promise<string[]>;
  /** Text and announcement channels both the bot and the viewer can post in */
  postableChannels(guildId: string, viewerId: string): Promise<ChannelInfo[]>;
  /** Roles that can be handed out (not @everyone, bot or integration roles), highest first */
  roles(guildId: string, viewerId: string): Promise<SettingsRole[]>;
  /** The viewer is the owner or has Manage Roles; the bot has Manage Roles */
  canCreateRoles(guildId: string, viewerId: string): Promise<{ viewer: boolean; bot: boolean }>;
  /** A role without permissions at the bottom of the list (below the bot's), so the bot can hand it out; its id */
  createRole(guildId: string, role: { name: string; color: string | null }, reason: string): Promise<string>;
  deleteRole(guildId: string, roleId: string, reason: string): Promise<void>;
}

// Only "Unknown Member" means not a member. A 429, 5xx or timeout must not
// turn into a 403, so it becomes a 503 instead.
const notAMember = (error: unknown): null => {
  if (
    error instanceof DiscordAPIError &&
    error.code === RESTJSONErrorCodes.UnknownMember
  ) {
    return null;
  }
  Logger.warn('Discord member lookup failed', error);
  throw new ServiceUnavailable('Discord member lookup failed');
};

// Cache first, gateway fetch as fallback
const findMember = async (guildId: string, userId: string) => {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  return guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(notAMember));
};

/** Guilds whose full member list was fetched once (memberIds) */
const fullyFetched = new Set<string>();

const live: DiscordDirectory = {
  guilds() {
    return client.guilds.cache.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
      memberCount: guild.memberCount,
      joinedAt: guild.joinedAt,
    }));
  },

  async isMember(guildId, userId) {
    return !!(await findMember(guildId, userId));
  },

  async canManage(guildId, userId) {
    const member = await findMember(guildId, userId);
    return !!member?.permissions.has(PermissionFlagsBits.ManageGuild);
  },

  guild(guildId) {
    const guild = client.guilds.cache.get(guildId);
    return guild ? { name: guild.name, icon: guild.iconURL() } : undefined;
  },

  channel(guildId, channelId) {
    const channel = client.guilds.cache
      .get(guildId)
      ?.channels.cache.get(channelId);
    return channel
      ? { id: channel.id, name: channel.name, type: ChannelType[channel.type] }
      : undefined;
  },

  async members(guildId, userIds) {
    const result = new Map<string, MemberInfo>();
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return result;
    const add = (member: GuildMember) =>
      result.set(member.id, {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        // The server avatar when they set one, like displayName
        avatar: member.displayAvatarURL(),
      });

    // Cache first: the gateway request is rate limited by Discord, and a
    // rate-limited fetch would turn every name into "Unknown User"
    const missing: string[] = [];
    for (const id of userIds) {
      const cached = guild.members.cache.get(id);
      if (cached) add(cached);
      else missing.push(id);
    }
    if (missing.length === 0) return result;

    try {
      // One batched gateway request instead of one fetch per member
      (await guild.members.fetch({ user: missing })).forEach(add);
    } catch (error) {
      Logger.warn(`Failed to batch-fetch members for guild ${guildId}`, error);
    }
    return result;
  },

  async memberIds(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return [];
    // Discord leaves offline members out of large guilds on connect; one full
    // fetch fills the cache, and later calls skip it
    if (!fullyFetched.has(guildId) && guild.members.cache.size < guild.memberCount) {
      fullyFetched.add(guildId);
      await guild.members.fetch().catch((error) => {
        fullyFetched.delete(guildId); // try again on the next request
        Logger.warn(`Failed to fetch all members for guild ${guildId}`, error);
      });
    }
    return [...guild.members.cache.filter((m) => !m.user.bot).keys()];
  },

  async postableChannels(guildId, viewerId) {
    const guild = client.guilds.cache.get(guildId);
    const viewer = await findMember(guildId, viewerId);
    if (!guild || !viewer) return [];
    const me = guild.members.me ?? (await guild.members.fetchMe());
    // Manage Server doesn't grant every channel, and the welcome message is the viewer's own
    // text: only offer channels where they could post it themselves
    return [...guild.channels.cache.values()]
      .filter(
        (c): c is TextChannel | NewsChannel =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          c.permissionsFor(me).has(POST_PERMISSIONS) &&
          c.permissionsFor(viewer).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
      )
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map((c) => ({ id: c.id, name: c.name, type: ChannelType[c.type] }));
  },

  async roles(guildId, viewerId) {
    const guild = client.guilds.cache.get(guildId);
    const viewer = await findMember(guildId, viewerId);
    if (!guild || !viewer) return [];
    // Role.editable reads the bot's member from the cache
    if (!guild.members.me) await guild.members.fetchMe();
    // Discord's own rule: Manage Roles and a highest role above it, or the owner
    const viewerCanAssign = (role: Role) =>
      guild.ownerId === viewer.id ||
      (viewer.permissions.has(PermissionFlagsBits.ManageRoles) && viewer.roles.highest.comparePositionTo(role) > 0);
    return [...guild.roles.cache.values()]
      .filter((r) => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.comparePositionTo(a))
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.colors.primaryColor ? r.hexColor : null,
        position: r.position,
        botCanAssign: r.editable,
        viewerCanAssign: viewerCanAssign(r),
      }));
  },

  async canCreateRoles(guildId, viewerId) {
    const guild = client.guilds.cache.get(guildId);
    const viewer = await findMember(guildId, viewerId);
    if (!guild || !viewer) return { viewer: false, bot: false };
    const me = guild.members.me ?? (await guild.members.fetchMe());
    return {
      viewer: guild.ownerId === viewer.id || viewer.permissions.has(PermissionFlagsBits.ManageRoles),
      bot: me.permissions.has(PermissionFlagsBits.ManageRoles),
    };
  },

  async createRole(guildId, { name, color }, reason) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new ServiceUnavailable('The bot is not in that server');
    // No permissions: a reward is a name and a colour, never access
    const role = await guild.roles.create({ name, colors: { primaryColor: color ? parseInt(color.slice(1), 16) : 0 }, permissions: [], reason });
    return role.id;
  },

  async deleteRole(guildId, roleId, reason) {
    await client.guilds.cache.get(guildId)?.roles.delete(roleId, reason);
  },
};

const mock: DiscordDirectory = {
  guilds() {
    return MOCK_GUILDS.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: null,
      memberCount: guild.members.length,
      joinedAt: null,
    }));
  },

  async isMember(guildId, userId) {
    return !!findMockGuild(guildId)?.members.some((m) => m.id === userId);
  },

  async canManage(guildId, userId) {
    return !!findMockGuild(guildId)?.managers.includes(userId);
  },

  guild(guildId) {
    const guild = findMockGuild(guildId);
    return guild ? { name: guild.name, icon: null } : undefined;
  },

  channel(guildId, channelId) {
    const guild = findMockGuild(guildId);
    return [...(guild?.channels ?? []), ...(guild?.textChannels ?? [])].find(
      (c) => c.id === channelId
    );
  },

  async members(guildId, userIds) {
    const result = new Map<string, MemberInfo>();
    for (const m of findMockGuild(guildId)?.members ?? []) {
      if (!userIds.includes(m.id)) continue;
      result.set(m.id, {
        id: m.id,
        username: m.username,
        displayName: m.displayName,
        avatar: defaultAvatarUrl(m.id),
      });
    }
    return result;
  },

  async memberIds(guildId) {
    return findMockGuild(guildId)?.members.map((m) => m.id) ?? [];
  },

  async postableChannels(guildId) {
    return findMockGuild(guildId)?.textChannels ?? [];
  },

  async roles(guildId, viewerId) {
    const guild = findMockGuild(guildId);
    return (guild?.roles ?? []).map((r) => ({ ...r, viewerCanAssign: !!guild?.managers.includes(viewerId) }));
  },

  async canCreateRoles(guildId, viewerId) {
    const guild = findMockGuild(guildId);
    return { viewer: !!guild?.managers.includes(viewerId), bot: !!guild };
  },

  async createRole(guildId, { name, color }) {
    const guild = findMockGuild(guildId);
    if (!guild) throw new ServiceUnavailable('No such mock server');
    const id = `9${Date.now()}${guild.roles.length}`;
    guild.roles.push({ id, name, color, position: 0, botCanAssign: true });
    return id;
  },

  async deleteRole(guildId, roleId) {
    const guild = findMockGuild(guildId);
    if (guild) guild.roles = guild.roles.filter((r) => r.id !== roleId);
  },
};

export const discordDirectory = (): DiscordDirectory =>
  isMockDiscord() ? mock : live;
