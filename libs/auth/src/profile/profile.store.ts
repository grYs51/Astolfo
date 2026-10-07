import { inject } from '@angular/core';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { botApi, DiscordUser } from '@nx-stolfo/common/api';
import { RequestOnInitState, withFetchOnInit } from '@nx-stolfo/common/store';

export type ProfileState = RequestOnInitState<DiscordUser>;

export const ProfileStore = signalStore(
  withFetchOnInit(() => inject(botApi).fetchStatus()),
  withMethods((store) => ({
    /** The API rejected the session (e.g. it expired while the app was open). */
    markLoggedOut: () => patchState(store, { value: undefined, error: null }),
  }))
);
