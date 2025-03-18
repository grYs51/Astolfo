import { JsonPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  linkedSignal,
} from '@angular/core';
import { IS_SESSION_CHECKED, USER } from '@nx-stolfo/auth';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import { NavbarComponent, PageComponent } from '@nx-stolfo/components';

@Component({
  selector: 'lib-dashboard',
  imports: [PageComponent, NavbarComponent, DiscordImagePipe, JsonPipe],
  templateUrl: './dashboard.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [],
})
export class DashboardComponent {
  user = inject(USER);

  sessionChecked = inject(IS_SESSION_CHECKED);

  backendUrl = inject(COMMON_BACKEND_API_URL);
}
