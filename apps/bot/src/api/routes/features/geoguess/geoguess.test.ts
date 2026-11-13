import { closeRound, createMapGame, guess, playRound, rankGuesses } from '../../../../geo/map-games';
import { gameView } from './geoguess';

jest.mock('../../../../client/instance', () => ({ client: {} }));

const BRUSSELS = { lat: 50.85, lon: 4.35 };
const round = { imageId: 'img', difficulty: 'hard' as const, answer: { country: 'Belgium', ...BRUSSELS } };
const members = new Map([['a', { id: 'a', username: 'alice', displayName: 'Alice', avatar: null }]]);

describe('gameView', () => {
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  test('while guessing: only the own pin, never the answer or other pins', () => {
    const game = createMapGame('guild', 3);
    void playRound(game, round, 90_000);
    guess(game, 'a', 48.85, 2.35);
    guess(game, 'b', 35.6, 139.6);
    const view = gameView(game, 'a', 'MLY|token', members);
    expect(view).toMatchObject({ round: 1, rounds: 3, phase: 'guessing', imageId: 'img', radiusKm: 500, guessCount: 2 });
    expect(view?.myGuess).toEqual({ lat: 48.85, lon: 2.35 });
    expect(view).not.toHaveProperty('answer');
    expect(view).not.toHaveProperty('pins');
    expect(JSON.stringify(view)).not.toContain('Belgium');
  });

  test('after the round: the answer, every pin with its place and XP, and the totals', () => {
    const game = createMapGame('guild', 1);
    void playRound(game, round, 90_000);
    guess(game, 'b', 35.6, 139.6);
    guess(game, 'a', 48.85, 2.35);
    closeRound(game, rankGuesses(game.current!.guesses, BRUSSELS, 500), new Map([['a', 30]]));
    const view = gameView(game, 'b', 't', members);
    expect(view?.answer).toEqual({ country: 'Belgium', ...BRUSSELS });
    expect(view?.pins?.map((p) => [p.member.id, p.place, p.xp])).toEqual([
      ['a', 1, 30],
      ['b', null, 0],
    ]);
    expect(view?.pins?.[1].member.username).toBe('Unknown User');
    expect(view?.scores.map((s) => [s.member.id, s.xp, s.inside])).toEqual([
      ['a', 30, 1],
      ['b', 0, 0],
    ]);
  });

  test('no round yet: nothing to show', () => {
    expect(gameView(createMapGame('guild', 1), 'a', 't', members)).toBeUndefined();
  });
});
