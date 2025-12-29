import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';

@Component({
  selector: 'pages-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  loginUrl = inject(COMMON_BACKEND_API_URL) + '/auth/login';
}
