import { Route } from "@angular/router";
import { DetailOverviewComponent } from "./detail-overview.component";
import { MemberProfileComponent } from "../member-profile/member-profile.component";

export const detailOverviewRoutes: Route[] = [
  {
    // Another member's activity on this server
    path: ':id/members/:memberId',
    component: MemberProfileComponent,
  },
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
