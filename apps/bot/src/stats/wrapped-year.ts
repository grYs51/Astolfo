/**
 * A year's Wrapped opens on 1 December (UTC), so until then the latest one is last year's.
 * The dashboard's Wrapped page has the same rule (`latestYear` in `wrapped.component.ts`).
 */
export const latestWrappedYear = (now = new Date()) => now.getUTCFullYear() - (now.getUTCMonth() === 11 ? 0 : 1);
