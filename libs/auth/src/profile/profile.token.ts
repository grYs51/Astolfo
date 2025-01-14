import { InjectionToken, Signal } from '@angular/core';
import { DiscordUser } from '@nx-stolfo/common/api';

export const IS_LOGGED_IN = new InjectionToken<Signal<boolean>>(
  'auth/is-logged-in'
);

// user token
export const USER = new InjectionToken<Signal<DiscordUser | null>>('auth/user');
