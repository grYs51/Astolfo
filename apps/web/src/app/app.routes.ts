import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadChildren: () => import('@nx-stolfo/pages').then(m => m.dashboardRoutes),
    }
];
