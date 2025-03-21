import { isPlatformBrowser } from "@angular/common";
import { effect, inject, PLATFORM_ID } from "@angular/core";
import { patchState, signalStore, withHooks, withState } from "@ngrx/signals";
import { ActiveServerApi } from "./active-server.api";

export interface guild {
  icon: string;
  name: string;
  id: string;
  memberCount: number;
}

export type guilds = guild[];

export type ProfileState = {
  value: guilds
  isLoading: boolean;
  error: unknown;
};

const initialState: ProfileState = {
  value: [],
  isLoading: true,
  error: null,
};


export const ActiveServerStore = signalStore(
  withState(initialState),
  withHooks({
    onInit: (store, api = inject(ActiveServerApi), id = inject(PLATFORM_ID)) => {
      if (isPlatformBrowser(id)) {
        const { isLoading, value, error } = api.fetchActiveServers();

        effect(() => {
          patchState(store, {
            value: value(),
            isLoading: isLoading(),
            error: error(),
          });
        });
      }
    },
  })
);
