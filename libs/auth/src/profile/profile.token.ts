import { InjectionToken, Signal } from "@angular/core";

export const IS_LOGGED_IN = new InjectionToken<Signal<boolean>>('auth/is-logged-in');