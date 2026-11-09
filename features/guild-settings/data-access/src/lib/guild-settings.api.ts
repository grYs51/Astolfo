import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import { GuildSettings } from '@nx-stolfo/api-interfaces';

/** Server settings; the API answers 403 to members without Manage Server */
export class GuildSettingsApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);
  private http = inject(HttpClient);

  fetchSettings(guildId: () => string) {
    return this.get<GuildSettings>(() => `/features/servers/${guildId()}/settings`);
  }

  /** Saves the whole form (one-off request, not a resource) */
  saveSettings(guildId: string, settings: GuildSettings) {
    return this.http.put<GuildSettings>(
      `${this.host}/features/servers/${guildId}/settings`,
      settings
    );
  }
}
