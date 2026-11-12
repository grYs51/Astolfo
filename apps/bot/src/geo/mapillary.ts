import { Logger } from '../utils/logger';
import { fetchImage } from '../cards/avatars';
import { DIFFICULTIES, shuffle, TriviaDifficulty, TriviaFetch } from '../trivia/opentdb';
import { COUNTRIES } from './countries.data';
import { POOL } from './pool.data';
import { GEO_CATEGORY, type GeoCountry, type GeoPoolEntry } from './types';

export const GEO_QUESTION = 'Which country is this?';

export const NOT_SET_UP_MESSAGE = "GeoGuess isn't set up on this bot yet.";
export const DOWN_MESSAGE = "🔌 Mapillary is down or not responding right now, so I can't show a photo. Try again later.";
export const BUSY_MESSAGE = 'Mapillary is busy. Try again in a minute.';

const API = 'https://graph.mapillary.com';
const TIMEOUT_MS = 5000;
/** A 1024 px photo is bigger than an avatar */
const IMAGE_TIMEOUT_MS = 8000;
/** A photo can be deleted from Mapillary after the pool was built: try this many before giving up */
const ATTEMPTS = 2;

export interface GeoData {
  pool: GeoPoolEntry[];
  countries: GeoCountry[];
  random: () => number;
}

const DEFAULT_DATA: GeoData = {
  pool: POOL,
  countries: COUNTRIES,
  random: Math.random,
};

/**
 * The right country and three wrong ones, shuffled. Easy draws the wrong ones from other regions, medium
 * from the same region but not the neighbours, hard includes up to two neighbours; each fills up from the
 * other groups when its own runs short.
 */
export const pickAnswers = (country: GeoCountry, difficulty: TriviaDifficulty, countries: GeoCountry[], random: () => number) => {
  const others = countries.filter((c) => c.code !== country.code);
  const neighbours = shuffle(
    others.filter((c) => country.borders.includes(c.code)),
    random
  );
  const region = shuffle(
    others.filter((c) => c.region === country.region && !country.borders.includes(c.code)),
    random
  );
  const far = shuffle(
    others.filter((c) => c.region !== country.region && !country.borders.includes(c.code)),
    random
  );
  const order =
    difficulty === 'easy'
      ? [...far, ...region, ...neighbours]
      : difficulty === 'medium'
        ? [...region, ...far, ...neighbours]
        : [...neighbours.slice(0, 2), ...region, ...far, ...neighbours.slice(2)];
  const wrong = order.slice(0, 3);
  return {
    answers: shuffle([country, ...wrong], random).map((c) => c.name),
    near: wrong.filter((c) => country.borders.includes(c.code)).map((c) => c.name),
  };
};

interface ApiImage {
  thumb_1024_url?: string;
  creator?: { username?: string };
  computed_geometry?: { coordinates: [number, number] };
  geometry?: { coordinates: [number, number] };
}

type Attempt = { ok: true; image: string; meta: ApiImage } | { ok: false; busy: boolean };

/** One photo: its details from the Graph API, then the thumbnail as a data URI */
const loadPhoto = async (id: string, token: string, fetchFn: typeof fetch): Promise<Attempt> => {
  try {
    const res = await fetchFn(`${API}/${id}?fields=thumb_1024_url,creator,computed_geometry,geometry`, {
      // A header, not the query string, so the token stays out of logged URLs
      headers: { Authorization: `OAuth ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    // The rate limit comes as HTTP 429 or as an error saying "Application request limit reached"
    if (res.status === 429 || /request limit/i.test(body?.error?.message ?? '')) return { ok: false, busy: true };
    if (!res.ok) {
      Logger.warn(`Mapillary answered HTTP ${res.status} for image ${id}: ${body?.error?.message ?? ''}`);
      return { ok: false, busy: false };
    }
    if (!body.thumb_1024_url) Logger.warn(`Mapillary image ${id} has no thumbnail`);
    const image = await fetchImage(body.thumb_1024_url, IMAGE_TIMEOUT_MS, fetchFn);
    return image ? { ok: true, image, meta: body } : { ok: false, busy: false };
  } catch (error) {
    Logger.warn(`Mapillary is unreachable: ${error instanceof Error ? error.message : error}`);
    return { ok: false, busy: false };
  }
};

/** A GeoGuess question from a random photo in the pool, or a message saying why there isn't one */
export const nextGeoQuestion = async (
  difficulty?: TriviaDifficulty,
  fetchFn: typeof fetch = fetch,
  data: GeoData = DEFAULT_DATA
): Promise<TriviaFetch> => {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token || !data.pool.length) {
    Logger.warn(`GeoGuess asked for but ${token ? 'the photo pool is empty' : 'MAPILLARY_TOKEN is not set'}`);
    return { ok: false, message: NOT_SET_UP_MESSAGE };
  }
  const level = difficulty ?? DIFFICULTIES[Math.floor(data.random() * DIFFICULTIES.length)];
  const tried = new Set<GeoPoolEntry>();
  let busy = false;
  for (let i = 0; i < ATTEMPTS && tried.size < data.pool.length; i++) {
    const untried = data.pool.filter((e) => !tried.has(e));
    const entry = untried[Math.floor(data.random() * untried.length)];
    tried.add(entry);
    // The pool script writes both files together, so a pool entry always has its country
    const country = data.countries.find((c) => c.code === entry.country);
    if (!country) continue;
    const photo = await loadPhoto(entry.id, token, fetchFn);
    if (!photo.ok) {
      busy ||= photo.busy;
      if (photo.busy) break;
      continue;
    }
    const { answers, near } = pickAnswers(country, level, data.countries, data.random);
    const [lon, lat] = (photo.meta.computed_geometry ?? photo.meta.geometry)?.coordinates ?? [];
    return {
      ok: true,
      question: {
        category: GEO_CATEGORY,
        difficulty: level,
        question: GEO_QUESTION,
        correct: country.name,
        answers,
        geo: {
          image: photo.image,
          credit: photo.meta.creator?.username,
          imageId: entry.id,
          country: country.code,
          lat,
          lon,
          near,
        },
      },
    };
  }
  return { ok: false, message: busy ? BUSY_MESSAGE : DOWN_MESSAGE };
};
