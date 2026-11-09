import { Route } from '@angular/router';
import { AdminComponent } from './admin.component';

export const adminRoutes: Route[] = [
  {
    path: '',
    component: AdminComponent,
    data: {
      title: 'Admin',
      breadCrumbs: [
        { path: 'overview', name: 'Dashboard' },
        { path: '', name: 'Admin' },
      ],
    },
  },
];
