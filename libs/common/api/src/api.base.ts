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

  get<T>(
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
    return httpResource<T>(request);
  }
}
