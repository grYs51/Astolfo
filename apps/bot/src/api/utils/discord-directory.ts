import { ChannelType } from 'discord.js';
import { client } from '../../client/instance';
import { Logger } from '../../utils/logger';
import {
  defaultAvatarUrl,
  findMockGuild,
  isMockDiscord,
} from '../../dev/mock-discord';

export type ChannelInfo = { id: string; name: string; type: string };

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
export interface DiscordDirectory {
  isMember(guildId: string, userId: string): Promise<boolean>;
  guild(guildId: string): { name: string; icon: string | null } | undefined;
  channel(guildId: string, channelId: string): ChannelInfo | undefined;
  members(guildId: string, userIds: string[]): Promise<Map<string, MemberInfo>>;
}

const live: DiscordDirectory = {
  async isMember(guildId, userId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return false;
    // Cache first, gateway fetch as fallback
    const member =
      guild.members.cache.get(userId) ??
      (await guild.members.fetch(userId).catch(() => null));
    return !!member;
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
    if (!guild || userIds.length === 0) return result;
    try {
      // One batched gateway request instead of one fetch per member
      const fetched = await guild.members.fetch({ user: userIds });
      fetched.forEach((member) =>
        result.set(member.id, {
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.displayAvatarURL(),
        })
      );
    } catch (error) {
      Logger.warn(`Failed to batch-fetch members for guild ${guildId}`, error);
    }
    return result;
  },
};

const mock: DiscordDirectory = {
  async isMember(guildId, userId) {
    return !!findMockGuild(guildId)?.members.some((m) => m.id === userId);
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
};

export const discordDirectory = (): DiscordDirectory =>
  isMockDiscord() ? mock : live;
