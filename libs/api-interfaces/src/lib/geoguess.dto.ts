import { DiscordMember } from './voice-stats.dto';

/** One pin on the result map: only sent once the round is over */
export interface GeoguessPin {
  member: DiscordMember;
  lat: number;
  lon: number;
  km: number;
  /** 1-based place among the pins inside the radius, null outside it */
  place: number | null;
  xp: number;
}

/** One player's total over the game so far */
export interface GeoguessScore {
  member: DiscordMember;
  xp: number;
  /** Rounds with a pin inside the radius */
  inside: number;
}

/**
 * `GET /features/servers/:serverId/geoguess/:gameId`. While `guessing`, the answer and the other players'
 * pins are left out.
 */
export interface GeoguessGameResponse {
  round: number;
  rounds: number;
  phase: 'guessing' | 'result' | 'over';
  /** Epoch ms when guessing closes */
  endsAt: number;
  imageId: string;
  /** Mapillary client token for the viewer */
  mapillaryToken: string;
  difficulty: 'easy' | 'medium' | 'hard';
  radiusKm: number;
  guessCount: number;
  myGuess: { lat: number; lon: number } | null;
  /** Set during `result` and `over` */
  answer?: { country: string; lat: number; lon: number };
  pins?: GeoguessPin[];
  /** Totals over the rounds played so far, ranked */
  scores: GeoguessScore[];
}

/** `POST …/geoguess/:gameId/guess` */
export interface GeoguessGuessRequest {
  lat: number;
  lon: number;
}
