import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileStore, USER } from '@nx-stolfo/auth';
import { PageComponent, NavbarComponent } from '@nx-stolfo/components';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { Router } from '@angular/router';

@Component({
  selector: 'lib-dashboard',
  imports: [PageComponent, NavbarComponent, DiscordImagePipe],
  templateUrl: './dashboard.component.html',
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfileStore],
})
export class DashboardComponent {
  user = inject(USER);

  host = inject(COMMON_BACKEND_API_URL);
}
