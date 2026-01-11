import {
  HttpHeaders,
  HttpParams,
  httpResource,
  HttpResourceRequest,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';

export const COMMON_BACKEND_API_URL = new InjectionToken<string>(
  'common/backend-api-url'
);

export abstract class ApiBase {
  protected host = inject(COMMON_BACKEND_API_URL);

  /**
   * Creates an HTTP resource that reactively tracks signal dependencies.
   * Pass signals or computed values as parameters, and the resource will
   * automatically refetch when those signals change.
   *
   * @example
   * // In your component:
   * id = input.required<string>();
   * period = signal('week');
   *
   * // The resource will refetch when id or period changes
   * resource = api.get(
   *   () => `/api/stats/${this.id()}/leaderboard`,
   *   () => ({ period: this.period() })
   * );
   */
  get<T>(
    path: string | (() => string),
    query?: { [param: string]: string | string[] } | (() => { [param: string]: string | string[] }),
    headers?: HttpHeaders | (() => HttpHeaders)
  ) {
    return httpResource<T>(() => {
      // Evaluate functions to track signal dependencies
      const url = typeof path === 'function' ? path() : path;
      const queryObj = typeof query === 'function' ? query() : (query ?? {});
      const headersObj = typeof headers === 'function' ? headers() : (headers ?? new HttpHeaders());

      const params = new HttpParams({ fromObject: queryObj });
      const request: HttpResourceRequest = {
        url: this.host + url,
        params,
        headers: headersObj,
      };
      return request;
    });
  }

  /**
   * Creates a static resource that doesn't track signal changes.
   * Use this when you want to fetch data once with the current values.
   */
  getStatic<T>(
    path: string,
    query: { [param: string]: string | string[] } = {},
    headers = new HttpHeaders()
  ) {
    const params = new HttpParams({ fromObject: query });
    const request: HttpResourceRequest = {
      url: this.host + path,
      params,
      headers,
    };
    return httpResource<T>(() => request);
  }
}
