import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { AppNotice, AuthUser } from '@nx-stolfo/api-interfaces';
import { COMMON_BOT_API_URL } from './bot-api.types';
import { ApiBase } from '../api.base';

export class botApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  private http = inject(HttpClient);

  fetchStatus() {
    return this.get<AuthUser>('/auth/status');
  }

  /** The owner's maintenance notice; public, so the login page can show it too */
  fetchNotice() {
    return this.get<AppNotice>('/notice');
  }

  /** One page view for the admin page; `path` is the route pattern (`overview/detail/:id`), never the URL */
  trackPageView(path: string) {
    return this.http.post<void>(`${this.host}/features/track`, { path });
  }
}
