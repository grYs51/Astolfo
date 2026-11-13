/**
 * Builds the GeoGuess photo pool from Mapillary's coverage tiles and the country list from mledoze/countries (the
 * dataset REST Countries was built on; REST Countries itself now needs an API key):
 *
 *   MAPILLARY_TOKEN=… yarn nx run bot:geo-pool   → apps/bot/src/geo/{countries,pool}.data.ts
 *
 * Run once (about 15 minutes and 1–3 GB of tiles: each capital and each photo's country is looked up at
 * OpenStreetMap, one request a second), look over a few photos, commit the two files. Only image ids are kept: the bot asks Mapillary for a
 * fresh thumbnail URL every time it shows one.
 */
import { writeFileSync } from 'fs';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { Logger } from '../utils/logger';
import type { GeoCountry, GeoPoolEntry } from '../geo/types';

/** Countries with good Mapillary coverage around the capital, spread over every region */
const CODES = (
  'US CA MX BR AR CL CO PE GB IE FR ES PT DE NL BE CH AT IT PL CZ SK HU RO BG GR HR SI RS DK SE NO FI EE LV LT ' +
  'UA TR JP KR TW TH VN MY ID PH IN AU NZ ZA KE NG EG MA IL AE'
).split(' ');
const PER_COUNTRY = 10;
const MIN_QUALITY = 0.6;
/**
 * Mapillary's coverage tiles have a point per photo at zoom 14 (a tile is about 2.4 km across at the equator). The
 * image search (graph.mapillary.com/images?bbox=…) fails with HTTP 500 in most capitals, even for small boxes.
 */
const ZOOM = 14;
/** Tile centres around the capital, in degrees: the centre and four neighbours. Near a border they reach the next country, so every photo's country is checked */
const OFFSETS = [
  [0, 0],
  [0.1, 0.1],
  [-0.1, 0.1],
  [0.1, -0.1],
  [-0.1, -0.1],
];
const OUT_DIR = path.join(__dirname, '../geo');
/** Pinned: a release never changes under us */
const COUNTRIES_URL = 'https://cdn.jsdelivr.net/gh/mledoze/countries@5.1.0/countries.json';

interface SourceCountry {
  cca2: string;
  cca3: string;
  name: { common: string };
  region: string;
  borders?: string[];
  capital?: string[];
}

interface Photo {
  id: string;
  lat: number;
  lon: number;
}

const getJson = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url.split('?')[0]}: HTTP ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
};

/** The ZOOM tile [x, y] holding a point (Web Mercator, as in every slippy map) */
const tileOf = (lat: number, lon: number) => {
  const n = 2 ** ZOOM;
  const r = (lat * Math.PI) / 180;
  return [
    Math.floor(((lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  ];
};

/** The best photos in the tile around a point: no panoramas, good quality, one per sequence (a sequence is one drive) */
const searchTile = async (token: string, lat: number, lon: number): Promise<Photo[]> => {
  const [x, y] = tileOf(lat, lon);
  const res = await fetch(`https://tiles.mapillary.com/maps/vtp/mly1_public/2/${ZOOM}/${x}/${y}?access_token=${token}`, {
    signal: AbortSignal.timeout(60_000),
  });
  // Not the URL: it holds the token
  if (!res.ok) throw new Error(`Mapillary tile ${ZOOM}/${x}/${y}: HTTP ${res.status}`);
  const layer = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer()))).layers.image;
  const best = new Map<string, { photo: Photo; quality: number }>();
  for (let i = 0; i < (layer?.length ?? 0); i++) {
    const feature = layer.feature(i);
    const { id, is_pano, quality_score, sequence_id } = feature.properties;
    const quality = Number(quality_score ?? 0);
    // The tile stores ids as numbers: one past 2^53 has lost digits
    if (is_pano || quality < MIN_QUALITY || !Number.isSafeInteger(id)) continue;
    const sequence = String(sequence_id ?? id);
    if ((best.get(sequence)?.quality ?? -1) >= quality) continue;
    const [pointLon, pointLat] = (feature.toGeoJSON(x, y, ZOOM).geometry as { coordinates: number[] }).coordinates;
    best.set(sequence, { photo: { id: String(id), lat: pointLat, lon: pointLon }, quality });
  }
  return [...best.values()].sort((a, b) => b.quality - a.quality).map((b) => b.photo);
};

/** OpenStreetMap's geocoder; it allows one request a second */
const nominatim = async <T>(query: string): Promise<T> => {
  await sleep(1100);
  return getJson<T>(`https://nominatim.openstreetmap.org/${query}`, { 'User-Agent': 'nx-stolfo-geo-pool' });
};

/** [lat, lon] of the country's (first) capital; the dataset only has its name */
const capitalOf = async (c: SourceCountry): Promise<[number, number] | undefined> => {
  const name = c.capital?.[0];
  if (!name) return undefined;
  const [hit] = await nominatim<{ lat: string; lon: string }[]>(
    `search?format=jsonv2&limit=1&countrycodes=${c.cca2.toLowerCase()}&q=${encodeURIComponent(name)}`
  );
  return hit ? [Number(hit.lat), Number(hit.lon)] : undefined;
};

/** The ISO code of the country a photo was taken in */
const countryOf = async ({ lat, lon }: Photo): Promise<string | undefined> => {
  const { address } = await nominatim<{ address?: { country_code?: string } }>(
    `reverse?format=jsonv2&zoom=3&lat=${lat}&lon=${lon}`
  );
  return address?.country_code?.toUpperCase();
};

const tsFile = (name: string, type: string, value: unknown) =>
  `// Generated by apps/bot/src/dev/geo-pool.ts. Rerun it rather than editing by hand.\n` +
  `import type { ${type} } from './types';\n\n` +
  `export const ${name}: ${type}[] = ${JSON.stringify(value, null, 2)};\n`;

const main = async () => {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) throw new Error('Set MAPILLARY_TOKEN (a client token from mapillary.com/dashboard/developers)');

  const all = await getJson<SourceCountry[]>(COUNTRIES_URL);
  const byCca3 = new Map(all.map((c) => [c.cca3, c.cca2]));
  const countries: GeoCountry[] = [];
  const pool: GeoPoolEntry[] = [];

  for (const code of CODES) {
    const c = all.find((x) => x.cca2 === code);
    const capital = c && (await capitalOf(c));
    if (!c || !capital) {
      Logger.warn(`${code}: not in the country list or capital not found, skipped`);
      continue;
    }
    // Round-robin over the tiles so one busy street doesn't fill the country
    const boxes = await Promise.all(OFFSETS.map(([dLat, dLon]) => searchTile(token, capital[0] + dLat, capital[1] + dLon)));
    const picked: string[] = [];
    let abroad = 0;
    for (let i = 0; picked.length < PER_COUNTRY && boxes.some((b) => b.length > i); i++) {
      for (const box of boxes) {
        if (!box[i] || picked.length >= PER_COUNTRY) continue;
        // A photo over the border would make the right answer wrong
        if ((await countryOf(box[i])) === code) picked.push(box[i].id);
        else abroad++;
      }
    }
    if (abroad) Logger.info(`${code}: ${abroad} photos outside the country or without a place, left out`);
    if (picked.length < 3) {
      Logger.warn(`${code}: only ${picked.length} good photos, skipped`);
      continue;
    }
    countries.push({
      code,
      name: c.name.common,
      region: c.region,
      borders: (c.borders ?? []).map((b) => byCca3.get(b)).filter((b): b is string => !!b),
    });
    pool.push(...picked.map((id) => ({ id, country: code })));
    Logger.info(`${code}: ${picked.length} photos`);
  }

  writeFileSync(path.join(OUT_DIR, 'countries.data.ts'), tsFile('COUNTRIES', 'GeoCountry', countries));
  writeFileSync(path.join(OUT_DIR, 'pool.data.ts'), tsFile('POOL', 'GeoPoolEntry', pool));
  Logger.info(`${countries.length} countries, ${pool.length} photos`);
};

main().catch((error) => {
  Logger.error('geo-pool failed', error);
  process.exit(1);
});
