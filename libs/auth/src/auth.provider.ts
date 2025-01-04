import {
    computed,
    EnvironmentProviders,
    Provider
} from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { ProfileState, ProfileStore } from './profile/profile.store';
import { IS_LOGGED_IN } from './profile/profile.token';
const isLoggedInFactory = (profileStore: StateSignals<ProfileState>) => {
  return computed(() => {
    return !profileStore.isLoading() && profileStore.profile() !== null;
  });
};

export const provideAuth = (): (EnvironmentProviders | Provider)[] => [
  {
    provide: IS_LOGGED_IN,
    useFactory: isLoggedInFactory,
    deps: [ProfileStore],
  },
  ProfileStore,
];
