// DTOs live in the shared lib (also imported by the Express handlers);
// re-exported here so UI consumers keep importing from data-access
export type {
  GuildSettings,
  GuildSettingsHistory,
  GuildToggle,
  LevelRole,
  ServerAccess,
  SettingChange,
  SettingsChannel,
  SettingsHistoryEntry,
  SettingsRole,
} from '@nx-stolfo/api-interfaces';
export * from './lib/guild-settings.api';
