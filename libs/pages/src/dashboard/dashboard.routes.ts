import { Route } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { AuthGuard } from '@nx-stolfo/auth';
export const dashboardRoutes: Route[] = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [AuthGuard()],
    data: {
      title: 'Dashboard',
      breadCrumbs: [
        {
          path: '',
          name: 'Dashboard',
        },
      ],
    },
  },
];
