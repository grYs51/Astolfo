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
  /** Channels the bot can post in and the viewer can see, plus the stored ones */
  channels: SettingsChannel[];
}

/**
 * One changed setting: `field` is a GuildSettings key (`prefix`, `welcomeChannelId`, …) or
 * `toggle:<key>`. A type, not an interface, so Prisma accepts it as JSON.
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
