import { Route } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
export const dashboardRoutes: Route[] = [
  {
    path: '',
    component: DashboardComponent,
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
