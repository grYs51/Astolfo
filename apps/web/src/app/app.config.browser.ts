import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';
import { ProfileStore } from '@nx-stolfo/auth';

const browserConfig: ApplicationConfig = {
  providers: [ProfileStore],
};

export const config = mergeApplicationConfig(appConfig, browserConfig);
