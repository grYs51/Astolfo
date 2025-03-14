import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID } from '@angular/core';
import { patchState, signalStore, withHooks, withState } from '@ngrx/signals';
import { botApi, DiscordUser } from '@nx-stolfo/common/api';

export type ProfileState = {
  profile: DiscordUser | null;
  isLoading: boolean;
  error: unknown;
};

const initialState: ProfileState = {
  profile: null,
  isLoading: true,
  error: null,
};

export const ProfileStore = signalStore(
  withState(initialState),
  withHooks({
    onInit: (store, api = inject(botApi), id = inject(PLATFORM_ID)) => {
      if (isPlatformBrowser(id)) {
        const { isLoading, value, error } = api.fetchStatus();

        effect(() => {
          patchState(store, {
            profile: value(),
            isLoading: isLoading(),
            error: error(),
          });
        });
      }
    },
  })
);
