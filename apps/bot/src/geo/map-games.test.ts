import { closeRound, createMapGame, getMapGame, guess, haversineKm, MapGame, playRound, rankGuesses } from './map-games';

const BRUSSELS = { lat: 50.8503, lon: 4.3517 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const TOKYO = { lat: 35.6762, lon: 139.6503 };

const round = { imageId: 'img', difficulty: 'medium' as const, answer: { country: 'Belgium', ...BRUSSELS } };

describe('haversineKm', () => {
  test('known city pairs', () => {
    expect(haversineKm(BRUSSELS, PARIS)).toBeCloseTo(264, -1);
    expect(haversineKm(BRUSSELS, TOKYO)).toBeCloseTo(9480, -2);
    expect(haversineKm(PARIS, PARIS)).toBe(0);
  });
});

describe('rankGuesses', () => {
  test('closest first, then the quickest, and marks who is inside the radius', () => {
    const guesses = new Map([
      ['far', { ...TOKYO, ms: 1000 }],
      ['slow', { ...PARIS, ms: 9000 }],
      ['quick', { ...PARIS, ms: 2000 }],
    ]);
    const ranked = rankGuesses(guesses, BRUSSELS, 1000);
    expect(ranked.map((g) => [g.userId, g.inside])).toEqual([
      ['quick', true],
      ['slow', true],
      ['far', false],
    ]);
  });
});

describe('a map game', () => {
  let game: MapGame;
  beforeEach(() => {
    jest.useFakeTimers({ now: 0 });
    game = createMapGame('guild', 2);
  });
  afterEach(() => jest.useRealTimers());

  test('is only found from its own guild', () => {
    expect(getMapGame('guild', game.id)).toBe(game);
    expect(getMapGame('other', game.id)).toBeUndefined();
  });

  test('refuses a second, late or out-of-range guess', async () => {
    const over = playRound(game, round, 90_000);
    expect(guess(game, 'a', 91, 0)).toBe('invalid');
    expect(guess(game, 'a', '50', 4)).toBe('invalid');
    expect(guess(game, 'a', 50, 4, 5000)).toBe('ok');
    expect(game.current?.guesses.get('a')).toEqual({ lat: 50, lon: 4, ms: 5000 });
    expect(guess(game, 'a', 51, 4)).toBe('already');
    expect(guess(game, 'b', 51, 4, 90_000)).toBe('closed');
    jest.advanceTimersByTime(90_000);
    await over;
    expect(guess(game, 'b', 51, 4)).toBe('closed');
  });

  test('round 1 waits the full time; from round 2 it ends once every viewer guessed', async () => {
    game.viewers.add('a').add('b');
    let ended = false;
    void playRound(game, round, 90_000).then(() => (ended = true));
    guess(game, 'a', 50, 4);
    guess(game, 'b', 50, 4);
    await Promise.resolve();
    expect(ended).toBe(false);
    jest.advanceTimersByTime(90_000);
    await Promise.resolve();
    expect(ended).toBe(true);

    closeRound(game, rankGuesses(game.current!.guesses, BRUSSELS, 1000), new Map([['a', 30]]));
    const second = playRound(game, round, 90_000);
    guess(game, 'a', 50, 4);
    expect(game.wake).toBeDefined();
    guess(game, 'b', 50, 4);
    await second;
    // Round 2 started at 90 s: it closed at once instead of at 180 s
    expect(game.current?.endsAt).toBe(90_000);
  });

  test('closing a round adds it to the totals', () => {
    void playRound(game, round, 90_000);
    guess(game, 'a', PARIS.lat, PARIS.lon);
    guess(game, 'b', TOKYO.lat, TOKYO.lon);
    closeRound(game, rankGuesses(game.current!.guesses, BRUSSELS, 1000), new Map([['a', 30]]));
    expect(game.phase).toBe('result');
    expect(game.totals).toEqual(
      new Map([
        ['a', { xp: 30, inside: 1 }],
        ['b', { xp: 0, inside: 0 }],
      ])
    );
  });
});
