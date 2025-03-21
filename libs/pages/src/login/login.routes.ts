import { Route } from "@angular/router";
import { LoginComponent } from "./login.component";

export const loginRoutes: Route[] = [
  {
    path: '',
    component: LoginComponent,
    data: {
      title: 'login',
      breadCrumbs: [
        {
          path: '',
          name: 'login',
        },
      ],
    },
  },
];
