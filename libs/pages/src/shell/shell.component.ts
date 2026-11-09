import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterOutlet
} from '@angular/router';
import { IS_LOGGED_IN, IS_SESSION_CHECKED, USER } from '@nx-stolfo/auth';
import { botApi, COMMON_BACKEND_API_URL } from '@nx-stolfo/common/api';
import { DiscordImagePipe } from '@nx-stolfo/common/pipes';
import {
  BreadCrumbs,
  BreadCrumbsComponent,
  NavbarComponent,
  NoticeBannerComponent,
  PageComponent,
} from '@nx-stolfo/components';
import { distinctUntilChanged, filter, map } from 'rxjs';

/** `overview/detail/:id`: the matched route config paths, so ids never reach the page_views table */
const routePattern = (snapshot: ActivatedRouteSnapshot | null): string => {
  const parts: string[] = [];
  for (let route = snapshot; route; route = route.firstChild) {
    if (route.routeConfig?.path) parts.push(route.routeConfig.path);
  }
  return parts.join('/');
};

@Component({
  selector: 'pages-shell',
  imports: [
    PageComponent,
    NavbarComponent,
    NoticeBannerComponent,
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

  readonly notice = inject(botApi).fetchNotice();

  // TODO - Check out how to get the breadcrumbs from the route
  breadcrumbs$ = this.route.data.pipe(
    map((data) => data['breadCrumbs'] as BreadCrumbs)
  );

  constructor() {
    // Page views for the admin page: browser only, logged in only, failures ignored
    const isLoggedIn = inject(IS_LOGGED_IN);
    const api = inject(botApi);
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        // A ?tab= change on the same page isn't another view
        distinctUntilChanged((a, b) => a.urlAfterRedirects.split('?')[0] === b.urlAfterRedirects.split('?')[0]),
        filter(() => isLoggedIn()),
        map(() => routePattern(this.router.routerState.snapshot.root)),
        filter(Boolean),
        takeUntilDestroyed()
      )
      .subscribe((path) => api.trackPageView(path).subscribe({ error: () => undefined }));
  }
}
