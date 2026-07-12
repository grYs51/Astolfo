import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ActiveServersListComponent } from '@nx-stolfo/active-servers/ui';

@Component({
  selector: 'pages-dashboard',
  imports: [ActiveServersListComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  router = inject(Router);

  selectedGuild(guildId: string) {
    this.router.navigate(['overview', 'detail', guildId]);
  }
}
