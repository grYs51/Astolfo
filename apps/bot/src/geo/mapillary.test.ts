import {
  BUSY_MESSAGE,
  DOWN_MESSAGE,
  GEO_CATEGORY,
  GeoData,
  nextGeoQuestion,
  NOT_SET_UP_MESSAGE,
  pickAnswers,
} from './mapillary';
import type { GeoCountry } from './types';

jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn() } }));

const country = (
  code: string,
  region: string,
  borders: string[] = [],
): GeoCountry => ({ code, name: `${code}-land`, region, borders });
const COUNTRIES = [
  country('BE', 'Europe', ['FR', 'NL', 'DE']),
  country('FR', 'Europe', ['BE', 'DE', 'ES']),
  country('NL', 'Europe', ['BE', 'DE']),
  country('DE', 'Europe', ['BE', 'FR', 'NL']),
  country('ES', 'Europe', ['FR']),
  country('IT', 'Europe'),
  country('PT', 'Europe', ['ES']),
  country('JP', 'Asia'),
  country('KR', 'Asia'),
  country('BR', 'Americas'),
  country('KE', 'Africa'),
];
const BE = COUNTRIES[0];
const byName = new Map(COUNTRIES.map((c) => [c.name, c]));

describe('pickAnswers', () => {
  test.each(['easy', 'medium', 'hard'] as const)(
    '%s: four distinct answers, one of them right',
    (difficulty) => {
      for (let seed = 0; seed < 20; seed++) {
        const { answers } = pickAnswers(
          BE,
          difficulty,
          COUNTRIES,
          mulberry(seed),
        );
        expect(answers).toHaveLength(4);
        expect(new Set(answers).size).toBe(4);
        expect(answers.filter((a) => a === BE.name)).toHaveLength(1);
      }
    },
  );

  test('easy: the wrong answers come from other regions', () => {
    const { answers, near } = pickAnswers(BE, 'easy', COUNTRIES, mulberry(1));
    expect(
      answers
        .filter((a) => a !== BE.name)
        .every((a) => byName.get(a)?.region !== 'Europe'),
    ).toBe(true);
    expect(near).toEqual([]);
  });

  test('medium: same region, never a neighbour', () => {
    const { answers, near } = pickAnswers(BE, 'medium', COUNTRIES, mulberry(2));
    const wrong = answers
      .filter((a) => a !== BE.name)
      .map((a) => byName.get(a));
    expect(
      wrong.every(
        (c) => c?.region === 'Europe' && !BE.borders.includes(c.code),
      ),
    ).toBe(true);
    expect(near).toEqual([]);
  });

  test('hard: two neighbours, and near is exactly the bordering answers', () => {
    const { answers, near } = pickAnswers(BE, 'hard', COUNTRIES, mulberry(3));
    const bordering = answers.filter((a) =>
      BE.borders.includes(byName.get(a)?.code ?? ''),
    );
    expect(bordering).toHaveLength(2);
    expect([...near].sort()).toEqual([...bordering].sort());
  });

  test('fills up from the other groups when a group runs short', () => {
    const { answers } = pickAnswers(
      country('AU', 'Oceania'),
      'medium',
      [...COUNTRIES, country('AU', 'Oceania')],
      mulberry(4),
    );
    expect(answers).toHaveLength(4);
  });
});

describe('nextGeoQuestion', () => {
  const data: GeoData = {
    pool: [
      { id: '1', country: 'BE' },
      { id: '2', country: 'BE' },
    ],
    countries: COUNTRIES,
    random: () => 0,
  };
  const json = (status: number, body: unknown) =>
    ({ status, ok: status < 300, json: async () => body }) as Response;
  const photo = {
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    arrayBuffer: async () => new ArrayBuffer(3),
  } as Response;
  const meta = {
    thumb_1024_url: 'https://img/1.jpg',
    creator: { username: 'walker' },
    computed_geometry: { type: 'Point', coordinates: [4.35, 50.85] },
  };

  beforeEach(() => {
    process.env.MAPILLARY_TOKEN = 'token';
  });
  afterAll(() => {
    delete process.env.MAPILLARY_TOKEN;
  });

  test('a photo question: the right country, the photo, the credit and the place', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(json(200, meta))
      .mockResolvedValueOnce(photo);
    const result = await nextGeoQuestion('hard', fetchFn, data);
    expect(result).toMatchObject({
      ok: true,
      question: {
        category: GEO_CATEGORY,
        difficulty: 'hard',
        correct: BE.name,
        geo: {
          image: 'data:image/jpeg;base64,AAAA',
          credit: 'walker',
          imageId: '1',
          country: 'BE',
          lat: 50.85,
          lon: 4.35,
        },
      },
    });
    // The token goes in a header, never the URL
    expect(fetchFn.mock.calls[0][0]).not.toContain('token');
    expect(fetchFn.mock.calls[0][1].headers).toEqual({
      Authorization: 'OAuth token',
    });
  });

  test('no token or an empty pool: not set up, nothing fetched', async () => {
    const fetchFn = jest.fn();
    delete process.env.MAPILLARY_TOKEN;
    expect(await nextGeoQuestion(undefined, fetchFn, data)).toEqual({
      ok: false,
      message: NOT_SET_UP_MESSAGE,
    });
    process.env.MAPILLARY_TOKEN = 'token';
    expect(
      await nextGeoQuestion(undefined, fetchFn, { ...data, pool: [] }),
    ).toEqual({ ok: false, message: NOT_SET_UP_MESSAGE });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('a deleted photo (404) tries another one', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(
        json(404, { error: { message: 'Unsupported get request' } }),
      )
      .mockResolvedValueOnce(json(200, meta))
      .mockResolvedValueOnce(photo);
    const result = await nextGeoQuestion('easy', fetchFn, data);
    expect(result).toMatchObject({
      ok: true,
      question: { geo: { imageId: '2' } },
    });
  });

  test('down twice: says Mapillary is down', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await nextGeoQuestion('easy', fetchFn, data)).toEqual({
      ok: false,
      message: DOWN_MESSAGE,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('the photo itself fails to download: tries another, then down', async () => {
    const fetchFn = jest.fn(async (url: string) =>
      url.startsWith('https://img') ? json(500, {}) : json(200, meta),
    );
    expect(
      await nextGeoQuestion('easy', fetchFn as unknown as typeof fetch, data),
    ).toEqual({ ok: false, message: DOWN_MESSAGE });
  });

  test('rate limited: says busy and stops at once', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        json(400, { error: { message: 'Application request limit reached' } }),
      );
    expect(await nextGeoQuestion('easy', fetchFn, data)).toEqual({
      ok: false,
      message: BUSY_MESSAGE,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(
      await nextGeoQuestion(
        'easy',
        jest.fn().mockResolvedValue(json(429, {})),
        data,
      ),
    ).toEqual({ ok: false, message: BUSY_MESSAGE });
  });
});

/** A small seeded random, so the shuffles differ per test but stay the same between runs */
function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
