import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ActiveServerApi,
  ActiveServerStore,
} from '@nx-stolfo/active-servers/data-access';
import { ActiveServersListComponent } from '@nx-stolfo/active-servers/ui';

@Component({
  selector: 'pages-dashboard',
  imports: [ActiveServersListComponent],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The page owns data fetching; the feature UI lib stays presentational
  providers: [ActiveServerStore, ActiveServerApi],
})
export class DashboardComponent {
  protected store = inject(ActiveServerStore);

  protected detailLink = (guildId: string) => ['/overview/detail', guildId];
}
