import { isPlatformServer } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { of, filter, switchMap, tap } from "rxjs";
import { IS_SESSION_CHECKED, IS_LOGGED_IN } from "../profile/profile.token";
import { toObservable } from '@angular/core/rxjs-interop';

export function AuthGuard(): CanActivateFn {
  return () => {
    const sessionCheck = inject(IS_SESSION_CHECKED);
    const isLoggedIn = inject(IS_LOGGED_IN);
    const platform = inject(PLATFORM_ID);
    const router = inject(Router);

    const sessionChecked$ = toObservable(sessionCheck);

    console.log('AuthGuard: Checking if user is logged in.');

    if (isPlatformServer(platform)) return of(false);

    return sessionChecked$.pipe(
      tap((value) => console.log('AuthGuard: Session check completed.', value)),
      filter(Boolean),
      switchMap(() => {
        if (!isLoggedIn()) {
          console.log('AuthGuard: User not logged in, redirecting to login page.');

          return of(router.createUrlTree(['/login']));
        }
        return of(true);
      })
    );
  };
}
