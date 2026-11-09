import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import {
  AdminHealth,
  AdminPeople,
  AdminServers,
  AdminUsage,
  AdminWeb,
} from '@nx-stolfo/api-interfaces';

/** Owner-only endpoints; the API answers 403 to everyone else. One resource per page section. */
export class AdminApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

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
}
