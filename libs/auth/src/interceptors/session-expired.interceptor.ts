import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ProfileStore } from '../profile/profile.store';
import { rememberReturnUrl } from '../guards/return-url';

/**
 * A 401 from the API means the session is gone (expired, or logged out in
 * another tab): mark the user logged out and send them to /login instead of
 * leaving every card in an error state. /auth/status is excluded — its 401 is
 * the normal "not logged in" answer and the guard already handles it.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  // Resolved lazily: ProfileStore's own /auth/status request goes through this
  // interceptor, so injecting it up front would be a circular dependency
  const injector = inject(Injector);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.url.endsWith('/auth/status')
      ) {
        // Only provided in the browser (provideAuth); absent during SSR
        injector.get(ProfileStore, null)?.markLoggedOut();
        // Back to this page after logging in again (a GeoGuess game mid-round)
        rememberReturnUrl(router.url);
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
