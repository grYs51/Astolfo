import { inject } from '@angular/core';
import {
  signalStore
} from '@ngrx/signals';
import { withFetchOnInit } from '@nx-stolfo/common/store';
import { ActiveServerApi } from './active-server.api';

export const ActiveServerStore = signalStore(
  withFetchOnInit(() => inject(ActiveServerApi).fetchActiveServers()),
);
