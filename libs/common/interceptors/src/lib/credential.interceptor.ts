import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const modifiedRequest = request.clone({
    withCredentials: true,
  });
  return next(modifiedRequest);
};
