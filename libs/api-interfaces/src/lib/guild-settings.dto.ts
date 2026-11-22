import { DateLike, DiscordMember } from './voice-stats.dto';

/** One feature toggle (a bit in guild_configs.toggles) */
export interface GuildToggle {
  key: string;
  label: string;
  enabled: boolean;
}

/** A channel the settings pickers offer */
export interface SettingsChannel {
  id: string;
  name: string;
  /** false for a stored channel that's no longer offered (only its own picker shows it) */
  postable: boolean;
}

/** A level role reward: members at `level` or above hold the role */
export interface LevelRole {
  level: number;
  /** '' while `newRole` is set */
  roleId: string;
  /** PUT only: create this role on save and reward it (needs `canCreateRoles`) */
  newRole?: { name: string; color: string | null };
}

/** A server role the level role pickers offer */
export interface SettingsRole {
  id: string;
  name: string;
  /** `#rrggbb`; null when the role has no colour */
  color: string | null;
  position: number;
  /** The bot can hand it out: it has Manage Roles and its highest role is above this one */
  botCanAssign: boolean;
  /** The viewer could hand it out themselves, so they may add it as a reward */
  viewerCanAssign: boolean;
}

/**
 * GET/PUT /features/servers/:serverId/settings (Manage Server only). PUT takes
 * the whole object and returns it saved; it ignores `channels` and labels.
 */
export interface GuildSettings {
  prefix: string;
  welcomeChannelId: string | null;
  /** `@member` becomes the new member's mention; empty = `Welcome @member` */
  welcomeMessage: string;
  /** Posted in the welcome channel; `@member` becomes their name; empty = no goodbye */
  goodbyeMessage: string;
  toggles: GuildToggle[];
  /** Weekly digest channel; null = off */
  digestChannelId: string | null;
  /** Level-up posts; null = off */
  levelUpChannelId: string | null;
  /** Level role rewards, lowest level first; only handed out while the LEVEL_ROLES toggle is on (kept while off) */
  levelRoles: LevelRole[];
  /** Channels the bot can post in and the viewer can see, plus the stored ones */
  channels: SettingsChannel[];
  /** The server's roles, highest first (ignored by PUT) */
  roles: SettingsRole[];
  /** Who may create a reward role on save: the viewer (owner or Manage Roles) and the bot (Manage Roles) */
  canCreateRoles: { viewer: boolean; bot: boolean };
}

/**
 * One changed setting: `field` is a GuildSettings key (`prefix`, `welcomeChannelId`, …),
 * `toggle:<key>`, `levelRole:<roleId>` (from/to: the level as a string, null = not a reward) or
 * `createdRole:<roleId>` (to: the new role's name). A type, not an interface, so Prisma accepts it as JSON.
 */
export type SettingChange = {
  field: string;
  from: string | boolean | null;
  to: string | boolean | null;
};

/** One save on the settings page */
export interface SettingsHistoryEntry {
  id: string;
  at: DateLike;
  member: DiscordMember;
  changes: SettingChange[];
}

/** GET /features/servers/:serverId/settings/history — newest first (Manage Server only) */
export interface GuildSettingsHistory {
  entries: SettingsHistoryEntry[];
}

/** GET /features/servers/:serverId/access — whether the viewer may open the settings page */
export interface ServerAccess {
  canManage: boolean;
}
