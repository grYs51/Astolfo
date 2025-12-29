import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideAuth } from '@nx-stolfo/auth';
import { appConfig } from './app.config';

const browserConfig: ApplicationConfig = {
  providers: [provideAuth()],
};

export const config = mergeApplicationConfig(appConfig, browserConfig);
