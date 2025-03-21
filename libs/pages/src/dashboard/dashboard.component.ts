import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActiveServersComponent } from '@nx-stolfo/active-servers';
import { IS_SESSION_CHECKED, USER } from '@nx-stolfo/auth';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import {
  BreadCrumbs,
  BreadCrumbsComponent,
  NavbarComponent,
  PageComponent,
} from '@nx-stolfo/components';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'pages-dashboard',
  imports: [
    PageComponent,
    NavbarComponent,
    BreadCrumbsComponent,
    DiscordImagePipe,
    AsyncPipe,
    ActiveServersComponent,
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
