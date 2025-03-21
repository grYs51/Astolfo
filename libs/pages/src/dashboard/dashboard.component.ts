import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActiveServersListComponent } from '@nx-stolfo/active-servers/ui';
import { USER, IS_SESSION_CHECKED } from '@nx-stolfo/auth';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import { PageComponent, NavbarComponent, BreadCrumbsComponent, BreadCrumbs } from '@nx-stolfo/components';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'pages-dashboard',
  imports: [
    PageComponent,
    NavbarComponent,
    BreadCrumbsComponent,
    DiscordImagePipe,
    AsyncPipe,
    ActiveServersListComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [],
})
export class DashboardComponent {
  user = inject(USER);

  readonly sessionChecked = inject(IS_SESSION_CHECKED);

  readonly backendUrl = inject(COMMON_BACKEND_API_URL);

  private readonly route = inject(ActivatedRoute);

  breadcrumbs$ = this.route.data.pipe(
    map((data) => data['breadCrumbs'] as BreadCrumbs),
    tap(console.log)
  );
}
