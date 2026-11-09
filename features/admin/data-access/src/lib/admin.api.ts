import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import {
  AdminBroadcastResult,
  AdminClosedSessions,
  AdminHealth,
  AdminPeople,
  AdminServers,
  AdminUsage,
  AdminWeb,
  AppNotice,
} from '@nx-stolfo/api-interfaces';

/** Owner-only endpoints; the API answers 403 to everyone else. One resource per page section. */
export class AdminApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);
  private http = inject(HttpClient);

  fetchHealth() {
    return this.get<AdminHealth>('/admin/health');
  }

  fetchServers() {
    return this.get<AdminServers>('/admin/servers');
  }

  fetchUsage() {
    return this.get<AdminUsage>('/admin/usage');
  }

  fetchPeople() {
    return this.get<AdminPeople>('/admin/people');
  }

  fetchWeb() {
    return this.get<AdminWeb>('/admin/web');
  }

  // Actions: one-off requests, not resources

  postDigest(guildId: string) {
    return this.http.post<{ posted: true }>(`${this.host}/admin/actions/digest`, { guildId });
  }

  leave(guildId: string) {
    return this.http.post<{ left: true }>(`${this.host}/admin/actions/leave`, { guildId });
  }

  closeStuckSessions() {
    return this.http.post<AdminClosedSessions>(`${this.host}/admin/actions/close-stuck-sessions`, {});
  }

  /** null clears the notice */
  setNotice(text: string | null) {
    return this.http.put<AppNotice>(`${this.host}/admin/notice`, { text });
  }

  broadcast(text: string) {
    return this.http.post<AdminBroadcastResult>(`${this.host}/admin/actions/broadcast`, { text });
  }
}
