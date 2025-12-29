import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideZoneChangeDetection
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideBackendApi, provideBotApi } from '@nx-stolfo/common/api';
import { credentialsInterceptor } from '@nx-stolfo/common/interceptors';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

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

  ],
};
