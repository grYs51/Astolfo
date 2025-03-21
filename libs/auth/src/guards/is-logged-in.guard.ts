import { isPlatformServer } from '@angular/common';
import { computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { IS_LOGGED_IN, IS_SESSION_CHECKED } from '../profile/profile.token';
export function AuthGuard(): CanActivateFn {
  const sessionCheck = inject(IS_SESSION_CHECKED);
  const isLoggedIn = inject(IS_LOGGED_IN);
  const platform = inject(PLATFORM_ID);

  return () => {

    if (isPlatformServer(platform)) return true;

    console.log('checking session');

    const sessionChecked = computed(() => sessionCheck());
    const loggedIn = computed(() => isLoggedIn());

    effect(() => {
      if (sessionChecked()) {
        console.log('session checked');
        if (!loggedIn()) {
          console.log('not logged in');
          // redirect to login
        }
      }
    });

    return loggedIn();
  };
}
