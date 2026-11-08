import { inject } from '@angular/core';
import { AuthUser } from '@nx-stolfo/api-interfaces';
import { COMMON_BOT_API_URL } from './bot-api.types';
import { ApiBase } from '../api.base';

export class botApi extends ApiBase {
  protected override host = inject(COMMON_BOT_API_URL);

  fetchStatus() {
    return this.get<AuthUser>('/auth/status');
  }
}
