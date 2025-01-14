import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  inject,
  InjectionToken
} from '@angular/core';
import { Observable } from 'rxjs';

export const COMMON_BACKEND_API_URL = new InjectionToken<string>(
  'common/backend-api-url'
);

export abstract class ApiBase {
  http = inject(HttpClient);

  protected host = inject(COMMON_BACKEND_API_URL);

  get<T>(
    path: string,
    query: { [param: string]: string | string[] } = {},
    headers = new HttpHeaders()
  ): Observable<T> {
    const params = new HttpParams({ fromObject: query });
    return this.http.get<T>(this.host + path, { params, headers });
  }
}

