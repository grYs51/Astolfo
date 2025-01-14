import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileStore, USER } from '@nx-stolfo/auth';
import { PageComponent, NavbarComponent } from '@nx-stolfo/components';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';

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
}
