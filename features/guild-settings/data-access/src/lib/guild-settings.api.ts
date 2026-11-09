import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import { GuildSettings, GuildSettingsHistory, ServerAccess } from '@nx-stolfo/api-interfaces';

/** Server settings; the API answers 403 to members without Manage Server */
export class GuildSettingsApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);
  private http = inject(HttpClient);

  /** Whether the viewer may open the settings page; any member may ask */
  fetchAccess(guildId: () => string) {
    return this.get<ServerAccess>(() => `/features/servers/${guildId()}/access`);
  }

  fetchSettings(guildId: () => string) {
    return this.get<GuildSettings>(() => `/features/servers/${guildId()}/settings`);
  }

  /** Who changed what on the settings page, newest first */
  fetchHistory(guildId: () => string) {
    return this.get<GuildSettingsHistory>(() => `/features/servers/${guildId()}/settings/history`);
  }

  /** Saves the whole form (one-off request, not a resource) */
  saveSettings(guildId: string, settings: GuildSettings) {
    return this.http.put<GuildSettings>(
      `${this.host}/features/servers/${guildId}/settings`,
      settings
    );
  }
}
