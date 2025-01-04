import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideBackendApi, provideBotApi } from '@nx-stolfo/common/api';
import { credentialsInterceptor } from '@nx-stolfo/common/interceptors';

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
  ],
};
