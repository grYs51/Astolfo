import { Route } from '@angular/router';
import { GeoguessComponent } from './geoguess.component';

export const geoguessRoutes: Route[] = [
  {
    path: ':serverId/:gameId',
    component: GeoguessComponent,
    title: 'GeoGuess',
  },
];
