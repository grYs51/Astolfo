import { inject, Injectable } from '@angular/core';
import { botApi } from './bot.api';

/** One GET /notice for the whole app (banner and admin page), so saving or clearing it shows in the banner at once */
@Injectable({ providedIn: 'root' })
export class NoticeState {
  readonly notice = inject(botApi).fetchNotice();
}
