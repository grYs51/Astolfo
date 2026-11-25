import type { XpRules } from './xp.dto';

export type GeoguessDifficulty = 'easy' | 'medium' | 'hard';

const KEYS = {
  easy: { radius: 'radiusEasy', fullKm: 'fullKmEasy', unsent: 'unsentEasy' },
  medium: { radius: 'radiusMedium', fullKm: 'fullKmMedium', unsent: 'unsentMedium' },
  hard: { radius: 'radiusHard', fullKm: 'fullKmHard', unsent: 'unsentHard' },
} as const;

/** The radius a new map game of this difficulty is played with */
export const geoguessRadius = (rules: XpRules, difficulty: GeoguessDifficulty) => rules.geoguess[KEYS[difficulty].radius];

export interface GeoguessXpInput {
  difficulty: GeoguessDifficulty;
  /** The pin's distance, rounded to whole km as it's saved */
  km: number;
  /** The game's own radius (its saved `radiusKm`), not necessarily the current rule */
  radiusKm: number;
  /** Everyone with a guess when the round closed, unsent pins included */
  players: number;
  /** The closest pin of the round (ties broken by speed) */
  closest: boolean;
  /** Counted from a pin placed but not sent */
  unsent: boolean;
  /** Trivia XP the member already earned that UTC day, for the daily cap */
  earnedToday?: number;
}

export interface GeoguessXp {
  inside: boolean;
  /** The full-points distance used: the rule, capped to the game's radius */
  fullKm: number;
  /** 1 within `fullKm`, falling in a straight line to 0 at the radius */
  closeness: number;
  pin: number;
  bonus: number;
  /** The difficulty multiplier */
  factor: number;
  unsentFactor: number;
  /** `(pin × closeness + bonus) × factor × unsentFactor` before rounding */
  raw: number;
  /** Rounded, before the daily cap */
  full: number;
  /** After the daily cap */
  xp: number;
}

/**
 * One map-mode GeoGuess round's XP. The bot's SQL grant (`grantTrivia` in `xp/grant.ts`) mirrors this, and
 * a db test checks both agree; the admin simulator calls it with the rules being typed.
 */
export const geoguessXp = (rules: XpRules, input: GeoguessXpInput): GeoguessXp => {
  const g = rules.geoguess;
  const keys = KEYS[input.difficulty];
  const { km, radiusKm, players } = input;
  const inside = km <= radiusKm;
  const fullKm = Math.min(g[keys.fullKm], radiusKm);
  const closeness = !inside || km >= radiusKm ? 0 : km <= fullKm ? 1 : (radiusKm - km) / (radiusKm - fullKm);
  const bonus = inside && input.closest && players >= 2 ? g.closest + g.perPlayer * Math.max(0, Math.min(players, g.crowdCap) - 2) : 0;
  const factor = rules.trivia[input.difficulty];
  const unsentFactor = input.unsent ? g[keys.unsent] : 1;
  const raw = inside ? (g.pin * closeness + bonus) * factor * unsentFactor : 0;
  // Postgres rounds exact numerics half up; trimming float noise first keeps 22.5 from landing on 22.4999…
  const full = Math.round(Number(raw.toFixed(6)));
  const xp = Math.min(full, Math.max(0, rules.thresholds.triviaDailyCap - (input.earnedToday ?? 0)));
  return { inside, fullKm, closeness, pin: g.pin, bonus, factor, unsentFactor, raw, full, xp };
};
