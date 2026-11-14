import { Route } from '@angular/router';
import { AuthGuard, OwnerGuard } from '@nx-stolfo/auth';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full',
  },
  {
    path: 'overview',
    loadComponent: () =>
      import('@nx-stolfo/pages').then((m) => m.ShellComponent),
    canActivate: [AuthGuard()],
    children: [
      {
        path: '',
        loadChildren: () =>
          import('@nx-stolfo/pages').then((m) => m.dashboardRoutes),
      },
      {
        path: 'detail',
        loadChildren: () =>
          import('@nx-stolfo/pages').then((m) => m.detailOverviewRoutes),
      },
      {
        // Owner only: the guard hides the page, the API's isOwner is the lock
        path: 'admin',
        canActivate: [OwnerGuard()],
        loadChildren: () =>
          import('@nx-stolfo/pages').then((m) => m.adminRoutes),
      },
    ],
  },
  {
    // Opened from the Play button of /geoguess mode:map in Discord
    path: 'play/geoguess',
    canActivate: [AuthGuard()],
    loadChildren: () => import('@nx-stolfo/pages').then((m) => m.geoguessRoutes),
  },
  {
    path: 'login',
    loadChildren: () => import('@nx-stolfo/pages').then((m) => m.loginRoutes),
  },
  {
    path: '**',
    redirectTo: 'overview',
  },
];
