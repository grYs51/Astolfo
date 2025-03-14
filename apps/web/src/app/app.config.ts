import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  signal,
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { IS_LOGGED_IN, IS_SESSION_CHECKED, USER } from '@nx-stolfo/auth';
import { provideBackendApi, provideBotApi } from '@nx-stolfo/common/api';
import { credentialsInterceptor } from '@nx-stolfo/common/interceptors';
import { appRoutes } from './app.routes';
import { environment } from '../environments/environment.development';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([credentialsInterceptor])),

    provideBackendApi({
      useFactory: () => `${environment.BACKEND_URL}/api`,
    }),

    provideBotApi({
      useFactory: () => `${environment.BACKEND_URL}/api`,
    }),
    {
      provide: IS_LOGGED_IN,
      useValue: signal(false),
    },
    {
      provide: USER,
      useValue: signal(null),
    },
    {
      provide: IS_SESSION_CHECKED,
      useValue: signal(false),
    }
  ],
};
