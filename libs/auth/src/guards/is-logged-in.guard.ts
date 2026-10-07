import { isPlatformServer } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { of, filter, map, take } from "rxjs";
import { IS_SESSION_CHECKED, IS_LOGGED_IN } from "../profile/profile.token";
import { toObservable } from '@angular/core/rxjs-interop';

export function AuthGuard(): CanActivateFn {
  return () => {
    const sessionCheck = inject(IS_SESSION_CHECKED);
    const isLoggedIn = inject(IS_LOGGED_IN);
    const platform = inject(PLATFORM_ID);
    const router = inject(Router);

    if (isPlatformServer(platform)) return of(false);

    const decide = () => isLoggedIn() || router.createUrlTree(['/login']);

    // Usual case: the session check finished long ago — answer directly.
    // toObservable creates an effect on the root injector that is never
    // destroyed, so only fall back to it while the first check is pending.
    if (sessionCheck()) return decide();

    return toObservable(sessionCheck).pipe(
      filter(Boolean),
      take(1),
      map(decide)
    );
  };
}
