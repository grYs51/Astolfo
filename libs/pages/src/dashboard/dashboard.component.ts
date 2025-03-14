import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IS_SESSION_CHECKED, ProfileStore, USER } from '@nx-stolfo/auth';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import { NavbarComponent, PageComponent } from '@nx-stolfo/components';

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

  sessionChecked = inject(IS_SESSION_CHECKED);
}
