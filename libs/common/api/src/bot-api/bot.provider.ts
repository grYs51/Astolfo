import {
  EnvironmentProviders,
  FactorySansProvider,
  Provider,
  ValueSansProvider,
} from '@angular/core';
import { COMMON_BOT_API_URL } from './bot-api.types';
import { botApi } from './bot.api';

export const provideBotApi = (
  UrlProvider: FactorySansProvider | ValueSansProvider
): (Provider | EnvironmentProviders)[] => [
  {
    provide: COMMON_BOT_API_URL,
    ...UrlProvider,
  },
  botApi,
];
