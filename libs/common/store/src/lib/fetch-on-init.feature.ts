import { HttpResourceRef } from '@angular/common/http';
import { effect } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withHooks,
  withState,
} from '@ngrx/signals';

export type RequestOnInitState<T> = {
  value: T | undefined;
  isLoading: boolean;
  error: unknown;
};

export function withFetchOnInit<T>(apiCallback: () => HttpResourceRef<T>) {
  return signalStoreFeature(
    withState<RequestOnInitState<T>>({
      value: undefined,
      isLoading: true,
      error: null,
    }),
    withHooks({
      onInit: (store) => {
        const { isLoading, value, error } = apiCallback();

        effect(() => {
          patchState(store, {
            value: error() ? undefined : value(),
            isLoading: isLoading(),
            error: error(),
          });
        });
      },
    })
  );
}
