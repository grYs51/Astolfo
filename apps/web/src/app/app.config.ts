import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection, signal } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { IS_LOGGED_IN } from '@nx-stolfo/auth';
import { provideBackendApi, provideBotApi } from '@nx-stolfo/common/api';
import { credentialsInterceptor } from '@nx-stolfo/common/interceptors';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([credentialsInterceptor])),

    provideBackendApi({
      useFactory: (env: string) => 'http://localhost:3000/api',
    }),

    provideBotApi({
      useFactory: (env: string) => 'http://localhost:3000/api',
    }),
    {
      provide: IS_LOGGED_IN,
      useValue: signal(false),
    },
  ],
};
