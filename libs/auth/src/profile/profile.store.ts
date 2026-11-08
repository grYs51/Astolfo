import { inject } from '@angular/core';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { AuthUser } from '@nx-stolfo/api-interfaces';
import { botApi } from '@nx-stolfo/common/api';
import { RequestOnInitState, withFetchOnInit } from '@nx-stolfo/common/store';

export type ProfileState = RequestOnInitState<AuthUser>;

export const ProfileStore = signalStore(
  withFetchOnInit(() => inject(botApi).fetchStatus()),
  withMethods((store) => ({
    /** The API rejected the session (e.g. it expired while the app was open). */
    markLoggedOut: () => patchState(store, { value: undefined, error: null }),
  }))
);
