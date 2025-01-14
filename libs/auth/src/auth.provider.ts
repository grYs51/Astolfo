import { computed, EnvironmentProviders, Provider } from '@angular/core';
import { StateSignals } from '@ngrx/signals';
import { ProfileState, ProfileStore } from './profile/profile.store';
import { IS_LOGGED_IN, USER } from './profile/profile.token';
const isLoggedInFactory = (profileStore: StateSignals<ProfileState>) =>
  computed(() => !profileStore.isLoading() && profileStore.profile() !== null);

const userFactory = (profileStore: StateSignals<ProfileState>) =>
  computed(() => profileStore.profile());

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
  ProfileStore,
];
