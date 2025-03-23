import { inject } from '@angular/core';
import { signalStore } from '@ngrx/signals';
import { botApi, DiscordUser } from '@nx-stolfo/common/api';
import { RequestOnInitState, withFetchOnInit } from '@nx-stolfo/common/store';

export type ProfileState = RequestOnInitState<DiscordUser>;

export const ProfileStore = signalStore(
  withFetchOnInit(() => inject(botApi).fetchStatus())
);
