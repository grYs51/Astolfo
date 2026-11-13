import { isPlatformServer } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";
import { CanActivateFn, Router, UrlTree } from "@angular/router";
import { of, filter, map, take } from "rxjs";
import { IS_SESSION_CHECKED, IS_LOGGED_IN, USER } from "../profile/profile.token";
import { toObservable } from '@angular/core/rxjs-interop';
import { rememberReturnUrl, takeReturnUrl } from './return-url';

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

/**
 * Logged out: remember the page and go to login. Login always lands on the dashboard, so the first guarded page
 * after it sends the visitor on to the page they wanted (a GeoGuess link from Discord).
 */
export function AuthGuard(): CanActivateFn {
  return (_route, state) => {
    const isLoggedIn = inject(IS_LOGGED_IN);
    const router = inject(Router);
    return afterSessionCheck(() => {
      if (!isLoggedIn()) {
        rememberReturnUrl(state.url);
        return router.createUrlTree(['/login']);
      }
      const back = takeReturnUrl();
      return back && back !== state.url ? router.parseUrl(back) : true;
    });
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
