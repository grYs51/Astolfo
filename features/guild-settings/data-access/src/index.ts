// DTOs live in the shared lib (also imported by the Express handlers);
// re-exported here so UI consumers keep importing from data-access
export type { GuildSettings, GuildToggle, SettingsChannel } from '@nx-stolfo/api-interfaces';
export * from './lib/guild-settings.api';
