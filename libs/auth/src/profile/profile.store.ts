import { effect } from '@angular/core';
import { patchState, signalStore, withHooks, withState } from '@ngrx/signals';
import { User } from 'discord.js';

type ProfileState = {
  profile: User | null;
  isLoading: boolean;
};

const initialState: ProfileState = {
  profile: null,
  isLoading: true,
};

export const ProfileStore = signalStore(
  withState(initialState),
  withHooks({
    onInit: (store) => {
      effect(() => {
        fetch('http://localhost:3000/api/auth/status', {
          credentials: 'include',
        })
          .then((response) => {
            console.log(response);

            return response.json();
          })
          .then((data) => {
            patchState(store, {
              profile: data,
              isLoading: false,
            });
          });
      });
    },
  })
);

// TODO: CREATE COMMON LIBS
