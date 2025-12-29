import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterOutlet
} from '@angular/router';
import { IS_SESSION_CHECKED, USER } from '@nx-stolfo/auth';
import { COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import {
  BreadCrumbs,
  BreadCrumbsComponent,
  NavbarComponent,
  PageComponent,
} from '@nx-stolfo/components';
import { map } from 'rxjs';

@Component({
  selector: 'pages-shell',
  imports: [
    PageComponent,
    NavbarComponent,
    BreadCrumbsComponent,
    DiscordImagePipe,
    AsyncPipe,
    RouterOutlet,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  user = inject(USER);

  router = inject(Router);

  readonly sessionChecked = inject(IS_SESSION_CHECKED);

  readonly backendUrl = inject(COMMON_BACKEND_API_URL);

  private readonly route = inject(ActivatedRoute);

  // TODO - Check out how to get the breadcrumbs from the route
  breadcrumbs$ = this.route.data.pipe(
    map((data) => data['breadCrumbs'] as BreadCrumbs)
  );
}
