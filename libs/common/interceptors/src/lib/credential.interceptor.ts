import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  console.log('credentialsInterceptor', request.url);

  const modifiedRequest = request.clone({
    withCredentials: true,
  });
  return next(modifiedRequest);
};
