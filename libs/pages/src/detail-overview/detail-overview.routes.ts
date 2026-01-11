import { Route } from "@angular/router";
import { DetailOverviewComponent } from "./detail-overview.component";

export const detailOverviewRoutes: Route[] = [
  {
    path: ':id',
    component: DetailOverviewComponent,
    data: {
      title: 'detail-overview',
      breadCrumbs: [
        {
          path: 'overview',
          name: 'Dashboard',
        },
        {
          path: '',
          name: 'Detail-overview',
        },
      ],
    },
  },
];
