// DTOs live in the shared lib (also imported by the Express handlers)
export type { GeoguessGameResponse, GeoguessGuessRequest, GeoguessPin, GeoguessScore } from '@nx-stolfo/api-interfaces';
export * from './lib/geoguess.api';
