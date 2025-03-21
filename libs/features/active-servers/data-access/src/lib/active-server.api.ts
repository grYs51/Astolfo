import { inject } from '@angular/core';
import {
  ApiBase,
  COMMON_BOT_API_URL,
  DiscordUser,
} from '@nx-stolfo/common/api';
import { guilds } from './active-server.store';

export class ActiveServerApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  fetchActiveServers() {
    return this.get<guilds>('/features/active-servers');
  }
}
