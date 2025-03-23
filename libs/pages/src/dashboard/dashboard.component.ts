import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActiveServersListComponent } from '@nx-stolfo/active-servers/ui';
import { IS_SESSION_CHECKED } from '@nx-stolfo/auth';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';

@Component({
  selector: 'pages-dashboard',
  imports: [ActiveServersListComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  router = inject(Router);

  readonly sessionChecked = inject(IS_SESSION_CHECKED);

  readonly backendUrl = inject(COMMON_BACKEND_API_URL);

  selectedGuild(guildId: string) {
    this.router.navigate(['overview', guildId]);
  }
}
