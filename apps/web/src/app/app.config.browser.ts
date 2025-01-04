import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';
import { provideAuth } from '@nx-stolfo/auth';

const browserConfig: ApplicationConfig = {
  providers: [provideAuth()]
};

export const config = mergeApplicationConfig(appConfig, browserConfig);
