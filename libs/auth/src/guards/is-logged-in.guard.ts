import { isPlatformServer } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { of, filter, map, take } from "rxjs";
import { IS_SESSION_CHECKED, IS_LOGGED_IN, USER } from "../profile/profile.token";
import { toObservable } from '@angular/core/rxjs-interop';

/** Runs `decide` once the first /auth/status check has finished. Call in an injection context. */
const afterSessionCheck = (decide: () => boolean | UrlTree) => {
  const sessionCheck = inject(IS_SESSION_CHECKED);
  const platform = inject(PLATFORM_ID);

  if (isPlatformServer(platform)) return of(false);

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

export function AuthGuard(): CanActivateFn {
  return () => {
    const isLoggedIn = inject(IS_LOGGED_IN);
    const router = inject(Router);
    return afterSessionCheck(() => isLoggedIn() || router.createUrlTree(['/login']));
  };
}

/** Hides the admin page from everyone but the bot owner. The lock is on the API (isOwner). */
export function OwnerGuard(): CanActivateFn {
  return () => {
    const user = inject(USER);
    const router = inject(Router);
    return afterSessionCheck(() => !!user()?.isOwner || router.createUrlTree(['/overview']));
  };
}
