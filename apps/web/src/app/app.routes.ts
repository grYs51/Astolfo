import { Route } from '@angular/router';
import { AuthGuard } from '@nx-stolfo/auth';

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
    ],
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
