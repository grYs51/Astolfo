import TicTacToe, { astolfoMove, bestMove, Board, Mark, winner } from './tictactoe';
import { InterActionUtils } from '../../utils/interaction-utils';
import { awardAndAnnounce } from '../../xp/level-up';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn(), editReply: jest.fn(async () => undefined) },
}));
jest.mock('../../utils/logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../xp/level-up', () => ({ awardAndAnnounce: jest.fn() }));

const empty = (): Board => Array(9).fill(null);
const board = (s: string): Board => [...s].map((c) => (c === '.' ? null : (c as Mark)));

describe('winner', () => {
  test.each([
    ['XXX......', [0, 1, 2]],
    ['...OOO...', [3, 4, 5]],
    ['X..X..X..', [0, 3, 6]],
    ['..O.O.O..', [2, 4, 6]],
  ])('finds the line in %s', (s, line) => {
    expect(winner(board(s))).toEqual({ mark: s.replace(/\./g, '')[0], line });
  });

  test('a full board with no line is a draw; an open one goes on', () => {
    expect(winner(board('XOXXOOOXX'))).toBe('draw');
    expect(winner(board('XO.......'))).toBeNull();
  });
});

describe("Astolfo's moves", () => {
  test('impossible never loses: every game the member can play ends in a draw or a loss', () => {
    let games = 0;
    const playAll = (b: Board) => {
      for (const cell of b.flatMap((c, i) => (c ? [] : [i]))) {
        const afterX = b.map((c, i) => (i === cell ? 'X' : c)) as Board;
        const r1 = winner(afterX);
        expect(r1 === null || r1 === 'draw').toBe(true);
        if (r1) { games++; continue; }
        const afterO = afterX.map((c, i) => (i === astolfoMove(afterX, 'impossible') ? 'O' : c)) as Board;
        if (winner(afterO)) { games++; continue; }
        playAll(afterO);
      }
    };
    playAll(empty());
    expect(games).toBeGreaterThan(0);
  });

  test('takes a win, and blocks one', () => {
    expect(bestMove(board('XX.OO....'), 'O')).toBe(5);
    expect(bestMove(board('XX..O....'), 'O')).toBe(2);
  });

  test('easy plays at random; normal slips 1 move in 4', () => {
    const b = board('...XX.O..'); // the best move is to block at 5; the first free cell is 0
    expect(astolfoMove(b, 'easy', () => 0)).toBe(0);
    expect(astolfoMove(b, 'normal', () => 0.1)).toBe(0); // 0.1 < 0.25: a slip
    expect(astolfoMove(b, 'normal', () => 0.5)).toBe(5);
    expect(astolfoMove(b, 'impossible', () => 0)).toBe(5);
  });
});

const user = (id: string, bot = false) => ({ id, bot, toString: () => `<@${id}>` });

/** Starts a game of a vs `opponent` and returns a way to click its cells */
const startGame = async (opponent = user('b'), difficulty?: string) => {
  const handlers: Record<string, (...args: never[]) => Promise<unknown>> = {};
  const collector = { on: (event: string, handler: never) => (handlers[event] = handler), stop: jest.fn() };
  const create = jest.fn(async () => ({}));
  const interaction = {
    id: 'int',
    guildId: 'g',
    user: user('a'),
    options: {
      get: (name: string) =>
        name === 'opponent' ? { user: opponent } : difficulty ? { value: difficulty } : undefined,
    },
    channel: { isSendable: () => true, createMessageComponentCollector: () => collector },
  };
  await (new TicTacToe() as unknown as { slash: (c: unknown, i: unknown) => Promise<void> }).slash(
    { user: { id: 'astolfo' }, dataSource: { gameResults: { create } } },
    interaction
  );
  const click = (id: string, cell: number) => {
    const i = { user: { id }, customId: `ttt:${cell}`, update: jest.fn(async () => undefined), reply: jest.fn(async () => undefined), deferUpdate: jest.fn(async () => undefined) };
    return handlers.collect(i as never).then(() => i);
  };
  return { click, create, collector, end: (reason: string) => handlers.end([] as never, reason as never) };
};

beforeEach(() => jest.clearAllMocks());

describe('/tictactoe', () => {
  test('a won game against a member is saved once, with both players, and earns the winner XP', async () => {
    const { click, create, collector } = await startGame();
    for (const [id, cell] of [['a', 0], ['b', 3], ['a', 1], ['b', 4]] as const) await click(id, cell);
    expect(create).not.toHaveBeenCalled();
    await Promise.all([click('a', 2), click('a', 2), click('b', 5)]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(collector.stop).toHaveBeenCalledWith('played');
    const { data } = (create.mock.calls[0] as unknown as [{ data: { game_type: unknown; players: { create: unknown } } }])[0];
    expect(data.game_type).toEqual({ connect: { id: 'tic-tac-toe' } });
    expect(data.players.create).toEqual([
      { user_id: 'a', result: 1, move: '0,1,2' },
      { user_id: 'b', result: 0, move: '3,4' },
    ]);
    expect(awardAndAnnounce).toHaveBeenCalledWith(expect.anything(), 'g', 'a', ['GAME']);
  });

  test('a click out of turn, or by someone else, plays nothing', async () => {
    const { click } = await startGame();
    const early = await click('b', 0);
    const stranger = await click('c', 0);
    expect(early.reply).toHaveBeenCalledWith({ content: "It's not your turn.", ephemeral: true });
    expect(stranger.reply).toHaveBeenCalledWith({ content: "This isn't your game.", ephemeral: true });
    const first = await click('a', 0);
    expect(first.update).toHaveBeenCalledTimes(1);
  });

  test('against Astolfo it answers each move, saves only the member, and earns no XP', async () => {
    const { click, create } = await startGame(user('astolfo', true), 'impossible');
    // Keep playing the first free cell until the game ends
    for (let n = 0; n < 5 && !create.mock.calls.length; n++) {
      for (let cell = 0; cell < 9; cell++) if ((await click('a', cell)).update.mock.calls.length) break;
    }
    expect(create).toHaveBeenCalledTimes(1);
    const { data } = (create.mock.calls[0] as unknown as [{ data: { game_type: unknown; metadata: { difficulty: string }; players: { create: { user_id: string; result: number }[] } } }])[0];
    expect(data.game_type).toEqual({ connect: { id: 'tic-tac-toe-astolfo' } });
    expect(data.metadata.difficulty).toBe('impossible');
    expect(data.players.create.map((p) => p.user_id)).toEqual(['a']);
    expect(data.players.create[0].result).not.toBe(1);
    expect(awardAndAnnounce).not.toHaveBeenCalled();
  });

  test('a minute without a move cancels the game and saves nothing', async () => {
    const { click, create, end } = await startGame();
    await click('a', 0);
    await end('idle');
    expect(create).not.toHaveBeenCalled();
    expect(InterActionUtils.editReply).toHaveBeenLastCalledWith(expect.anything(), {
      content: "Game cancelled: <@b> didn't move for a minute.",
      components: [],
    });
  });

  test('rejects another bot as the opponent', async () => {
    await startGame(user('music-bot', true));
    expect(InterActionUtils.send).toHaveBeenCalledWith(expect.anything(), { content: 'Please choose a valid user to challenge!' }, true);
  });
});
