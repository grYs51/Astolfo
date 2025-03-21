import { inject } from '@angular/core';
import { ApiBase, COMMON_BOT_API_URL } from '@nx-stolfo/common/api';
import { guilds } from './active-servers.model';

export class ActiveServerApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  fetchActiveServers() {
    return this.get<guilds>('/features/active-servers');
  }
}
