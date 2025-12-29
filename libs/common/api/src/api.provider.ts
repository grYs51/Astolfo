import { FactorySansProvider, ValueSansProvider, Provider, EnvironmentProviders } from "@angular/core";
import { COMMON_BACKEND_API_URL } from "./api.base";

export const provideBackendApi = (
    UrlProvider: FactorySansProvider | ValueSansProvider
  ): (Provider | EnvironmentProviders)[] => [
    {
      provide: COMMON_BACKEND_API_URL,
      ...UrlProvider,
    },
  ];
  