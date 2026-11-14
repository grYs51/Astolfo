import { randomUUID } from 'node:crypto';
import type { TriviaDifficulty } from '../trivia/opentdb';

/** Walking around and placing a pin take longer than clicking a button */
export const MAP_ANSWER_MS = 90_000;
/** A pin this close counts as a right answer; the difficulty still sets the trivia ×factor */
export const RADIUS_KM: Record<TriviaDifficulty, number> = { easy: 2000, medium: 1000, hard: 500 };
/** How long a finished game stays readable, so the page can show the scoreboard */
export const KEEP_MS = 10 * 60_000;

const EARTH_KM = 6371;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface MapGuess extends LatLon {
  /** From the photo showing to the guess */
  ms: number;
}

export interface RankedGuess extends MapGuess {
  userId: string;
  km: number;
  inside: boolean;
}

export interface MapRound {
  imageId: string;
  difficulty: TriviaDifficulty;
  /** `country` is the name, as on the result */
  answer: LatLon & { country: string };
  shownAt: number;
  endsAt: number;
  guesses: Map<string, MapGuess>;
  /** Set when the round closes */
  ranked?: RankedGuess[];
  xp?: Map<string, number>;
}

export interface MapGame {
  id: string;
  guildId: string;
  rounds: number;
  /** 1-based; 0 until the first round starts */
  round: number;
  phase: 'guessing' | 'result' | 'over';
  current?: MapRound;
  /** Members who opened the game on the site: from round 2, a round ends early once they've all guessed */
  viewers: Set<string>;
  totals: Map<string, { xp: number; inside: number }>;
  /** Ends the wait for guesses early */
  wake?: () => void;
}

/**
 * Running and recently finished map games, by id. The API runs in the bot's process, so its handlers read the
 * same map. shortcut: a bot restart loses a running game (like trivia's button collector); move this to the
 * DB if the API ever runs as its own process.
 */
const games = new Map<string, MapGame>();

export const createMapGame = (guildId: string, rounds: number): MapGame => {
  const game: MapGame = { id: randomUUID(), guildId, rounds, round: 0, phase: 'guessing', viewers: new Set(), totals: new Map() };
  games.set(game.id, game);
  return game;
};

/** Only from the guild it was started in */
export const getMapGame = (guildId: string, id: string) => {
  const game = games.get(id);
  return game?.guildId === guildId ? game : undefined;
};

/** Keeps the finished game readable for a while, then forgets it */
export const endMapGame = (game: MapGame) => {
  game.phase = 'over';
  game.wake = undefined;
  setTimeout(() => games.delete(game.id), KEEP_MS).unref();
};

/** Starts the next round and resolves when guessing closes: at `endsAt`, or once everyone who opened the game guessed */
export const playRound = (game: MapGame, round: Omit<MapRound, 'shownAt' | 'endsAt' | 'guesses'>, answerMs: number, now = Date.now()) => {
  game.round += 1;
  game.phase = 'guessing';
  game.current = { ...round, shownAt: now, endsAt: now + answerMs, guesses: new Map() };
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, answerMs);
    function done() {
      clearTimeout(timer);
      game.wake = undefined;
      // A late click after this is refused, even before the round is ranked
      if (game.current) game.current.endsAt = Math.min(game.current.endsAt, Date.now());
      resolve();
    }
    game.wake = done;
  });
};

/** Shows the round's result on the page and adds it to the totals */
export const closeRound = (game: MapGame, ranked: RankedGuess[], xp: Map<string, number>) => {
  if (!game.current) return;
  game.current.ranked = ranked;
  game.current.xp = xp;
  game.phase = 'result';
  for (const g of ranked) {
    const total = game.totals.get(g.userId) ?? { xp: 0, inside: 0 };
    game.totals.set(g.userId, { xp: total.xp + (xp.get(g.userId) ?? 0), inside: total.inside + (g.inside ? 1 : 0) });
  }
};

export const validLatLon = (lat: unknown, lon: unknown): boolean =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

export type GuessResult = 'ok' | 'closed' | 'already' | 'invalid';

/** One guess per member per round, while the round is open */
export const guess = (game: MapGame, userId: string, lat: unknown, lon: unknown, now = Date.now()): GuessResult => {
  const round = game.current;
  if (!round || game.phase !== 'guessing' || now >= round.endsAt) return 'closed';
  if (!validLatLon(lat, lon)) return 'invalid';
  if (round.guesses.has(userId)) return 'already';
  round.guesses.set(userId, { lat: lat as number, lon: lon as number, ms: now - round.shownAt });
  game.viewers.add(userId);
  // Not in round 1: the first player to open the link would end it before the others have it open
  if (game.round > 1 && [...game.viewers].every((id) => round.guesses.has(id))) game.wake?.();
  return 'ok';
};

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance */
export const haversineKm = (a: LatLon, b: LatLon) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Closest first, then the quickest */
export const rankGuesses = (guesses: Map<string, MapGuess>, answer: LatLon, radiusKm: number): RankedGuess[] =>
  [...guesses]
    .map(([userId, g]) => {
      const km = haversineKm(g, answer);
      return { userId, ...g, km, inside: km <= radiusKm };
    })
    .sort((a, b) => a.km - b.km || a.ms - b.ms);
