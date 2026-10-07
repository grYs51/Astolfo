import { HttpErrorResponse } from '@angular/common/http';
import { computed, EnvironmentProviders, Provider } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { ProfileState, ProfileStore } from './profile/profile.store';
import {
  IS_LOGGED_IN,
  IS_SESSION_CHECKED,
  USER,
} from './profile/profile.token';
const isLoggedInFactory = (profileStore: StateSignals<ProfileState>) =>
  computed(() => {
    if (profileStore.isLoading()) return false;
    if (profileStore.value()) return true;
    // Only a 401 means "no session". A Discord rate limit or server error on
    // /auth/status shouldn't bounce a logged-in user to /login; the session
    // cookie is still valid for the stats endpoints.
    const error = profileStore.error();
    return error instanceof HttpErrorResponse && error.status !== 401;
  });

const userFactory = (profileStore: StateSignals<ProfileState>) =>
  computed(() => profileStore.value());

const isSessionCheckedFactory = (profileStore: StateSignals<ProfileState>) =>
  computed(() => !profileStore.isLoading());

export const provideAuth = (): (EnvironmentProviders | Provider)[] => [
  {
    provide: IS_LOGGED_IN,
    useFactory: isLoggedInFactory,
    deps: [ProfileStore],
  },
  {
    provide: USER,
    useFactory: userFactory,
    deps: [ProfileStore],
  },
  {
    provide: IS_SESSION_CHECKED,
    useFactory: isSessionCheckedFactory,
    deps: [ProfileStore],
  },
  ProfileStore,
];
