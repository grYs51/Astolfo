import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { COMMON_BACKEND_API_URL, NoticeState } from '@nx-stolfo/common/api';
import { NoticeBannerComponent } from '@nx-stolfo/components';

@Component({
  selector: 'pages-login',
  imports: [NoticeBannerComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  loginUrl = inject(COMMON_BACKEND_API_URL) + '/auth/login';
  notice = inject(NoticeState).notice;
}
