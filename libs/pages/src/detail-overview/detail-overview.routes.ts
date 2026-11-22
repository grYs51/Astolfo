import { Route } from "@angular/router";
import { DetailOverviewComponent } from "./detail-overview.component";
import { MemberProfileComponent } from "../member-profile/member-profile.component";
import { GuildSettingsComponent } from "../guild-settings/guild-settings.component";
import { WrappedComponent } from "../wrapped/wrapped.component";

export const detailOverviewRoutes: Route[] = [
  {
    // A member's year on this server (Server Wrapped), yours included
    path: ':id/members/:memberId/wrapped',
    component: WrappedComponent,
  },
  {
    // Another member's activity on this server
    path: ':id/members/:memberId',
    component: MemberProfileComponent,
  },
  {
    // Server settings (Manage Server only; the API answers 403 to others)
    path: ':id/settings',
    component: GuildSettingsComponent,
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
