import type { GuildMember } from 'discord.js';
import type { LevelRole } from '@nx-stolfo/api-interfaces';
import type DiscordClient from '../client/client';
import type { Db } from '../db';
import { discordDirectory } from '../api/utils/discord-directory';
import { Logger } from '../utils/logger';
import { guildTotals } from './grant';
import { currentRules, levelFor } from './rules';

const REASON = 'Level role reward';

/** A server's level role rewards, lowest level first */
export const levelRolesOf = async (db: Db, guildId: string): Promise<LevelRole[]> =>
  (await db.levelRoles.findMany({ where: { guild_id: guildId }, orderBy: { level: 'asc' } })).map((r) => ({
    level: r.level,
    roleId: r.role_id,
  }));

/**
 * What a member at `level` must gain and lose to hold every reward role at or below it and none above
 * (they stack). Roles outside the mapping are never touched, so removing a reward leaves it on members.
 */
export const rolesToSync = (mapping: LevelRole[], level: number, held: { has(roleId: string): boolean }) => ({
  add: mapping.filter((r) => r.level <= level && !held.has(r.roleId)).map((r) => r.roleId),
  remove: mapping.filter((r) => r.level > level && held.has(r.roleId)).map((r) => r.roleId),
});

/** Brings one member's reward roles in line; returns the roles it couldn't touch */
const syncMember = async (member: GuildMember, mapping: LevelRole[], level: number) => {
  const { add, remove } = rolesToSync(mapping, level, member.roles.cache);
  // Role.editable: the bot has Manage Roles and its highest role is above this one. A deleted role is missing.
  const can = (roleId: string) => !!member.guild.roles.cache.get(roleId)?.editable;
  try {
    if (add.some(can)) await member.roles.add(add.filter(can), REASON);
    if (remove.some(can)) await member.roles.remove(remove.filter(can), REASON);
  } catch (error) {
    Logger.warn(`Level role sync failed for ${member.id} in guild ${member.guild.id}`, error);
  }
  return [...add, ...remove].filter((roleId) => !can(roleId));
};

const warnSkipped = (guildId: string, roleIds: Iterable<string>) =>
  Logger.warn(
    `Level roles in guild ${guildId}: can't hand out ${[...roleIds].join(', ')} (deleted, at or above my highest role, or no Manage Roles)`
  );

/** After a level-up: give the member their reward roles. Never throws. */
export const syncMemberLevelRoles = async (client: DiscordClient, guildId: string, memberId: string, level: number) => {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const mapping = await levelRolesOf(client.dataSource, guildId);
    if (!mapping.length) return;
    const member = await guild.members.fetch(memberId).catch(() => null);
    if (!member) return;
    const skipped = await syncMember(member, mapping, level);
    if (skipped.length) warnSkipped(guildId, skipped);
  } catch (error) {
    Logger.error(`Level role sync failed for ${memberId} in guild ${guildId}`, error);
  }
};

/** The newest backfill per guild; an older one stops when a new save or recalculation starts over */
const backfills = new Map<string, object>();

/**
 * Every member of a server to the level roles their XP earns: after the mapping changes, a recalculation
 * or a sweep that granted XP. One member at a time, so discord.js queues the requests under Discord's
 * rate limit; only members whose roles differ cost a request. Never throws.
 */
export const syncGuildLevelRoles = async (client: DiscordClient, guildId: string) => {
  const run = {};
  backfills.set(guildId, run);
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const mapping = await levelRolesOf(client.dataSource, guildId);
    if (!mapping.length) return;
    // Fills the member cache once, so members without XP lose roles they hold above level 0
    const ids = await discordDirectory().memberIds(guildId);
    const totals = await guildTotals(client.dataSource, guildId);
    const rules = currentRules();
    const skipped = new Set<string>();
    for (const id of ids) {
      if (backfills.get(guildId) !== run) return;
      const member = guild.members.cache.get(id);
      if (!member) continue;
      for (const roleId of await syncMember(member, mapping, levelFor(totals.get(id) ?? 0, rules))) skipped.add(roleId);
    }
    if (skipped.size) warnSkipped(guildId, skipped);
  } catch (error) {
    Logger.error(`Level role backfill failed for guild ${guildId}`, error);
  } finally {
    if (backfills.get(guildId) === run) backfills.delete(guildId);
  }
};
