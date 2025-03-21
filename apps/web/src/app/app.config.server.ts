import { mergeApplicationConfig, ApplicationConfig, signal } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRouting } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { IS_LOGGED_IN, USER, IS_SESSION_CHECKED } from '@nx-stolfo/auth';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRouting(serverRoutes),
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
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
