// get(/auth/login)

import { inject } from '@angular/core';
import { COMMON_BOT_API_URL, DiscordUser } from './bot-api.types';
import { ApiBase } from '../api.base';

export class botApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  fetchStatus() {
    return this.get<DiscordUser>('/auth/status');
  }
}
