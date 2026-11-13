import RockPaperScissors, { astolfoMove } from './rockpaperscissors';
import { InterActionUtils } from '../../utils/interaction-utils';
import { cardFile } from '../../cards/render';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { send: jest.fn(), editReply: jest.fn(async () => undefined) },
}));
jest.mock('../../utils/logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../cards/members', () => ({
  cardMembers: jest.fn(async () => ({ a: { name: 'A' }, b: { name: 'B' } })),
}));
jest.mock('../../cards/render', () => ({ ...jest.requireActual('../../cards/render'), cardFile: jest.fn() }));

const user = (id: string) => ({ id, bot: false, toString: () => `<@${id}>` });

/** Starts a game of a vs b and returns a way to click its buttons */
const startGame = async (opponent = user('b')) => {
  const handlers: Record<string, (...args: never[]) => Promise<unknown>> = {};
  const collector = {
    on: (event: string, handler: never) => (handlers[event] = handler),
    stop: jest.fn(),
    ended: false,
  };
  const create = jest.fn(async () => ({}));
  // The collector lives on the game message the command sends
  (InterActionUtils.send as jest.Mock).mockResolvedValue({ createMessageComponentCollector: () => collector });
  const interaction = {
    id: 'int',
    guildId: 'g',
    guild: {},
    user: user('a'),
    options: { get: () => ({ user: opponent }) },
  };
  await (new RockPaperScissors() as unknown as { slash: (c: unknown, i: unknown) => Promise<void> }).slash(
    { user: { id: 'astolfo' }, dataSource: { gameResults: { create } } },
    interaction
  );
  const replies: { id: string; content: string; ephemeral: boolean }[] = [];
  const click = (id: string, move: string, deferFails = false) =>
    handlers.collect({
      user: { id },
      customId: move,
      deferUpdate: jest.fn(async () => {
        if (deferFails) throw new Error('Unknown interaction');
      }),
      reply: jest.fn(async (r: { content: string; ephemeral: boolean }) => replies.push({ id, ...r })),
    } as never);
  const end = (reason: string) => handlers.end(new Map() as never, reason as never);
  return { click, end, create, collector, replies };
};

beforeEach(() => {
  jest.clearAllMocks();
  (cardFile as jest.Mock).mockResolvedValue({ name: 'rockpaperscissors.png' });
});

describe('/rockpaperscissors', () => {
  test('saves the game and shows the card even when acknowledging the click fails', async () => {
    const { click, create, collector } = await startGame();
    await click('a', 'rock');
    expect(create).not.toHaveBeenCalled();
    await click('b', 'paper', true);

    expect(create).toHaveBeenCalledTimes(1);
    expect(collector.stop).toHaveBeenCalledWith('played');
    const [, reply] = (InterActionUtils.editReply as jest.Mock).mock.lastCall;
    expect(reply.files).toHaveLength(1);
    expect(reply.content).toBe('<@a> vs <@b>');
  });

  test('a player sees their own pick, and the game message shows who has picked', async () => {
    const { click, replies } = await startGame();
    await click('a', 'rock');

    expect(replies).toEqual([expect.objectContaining({ id: 'a', ephemeral: true, content: expect.stringContaining('🪨') })]);
    const [, board] = (InterActionUtils.editReply as jest.Mock).mock.lastCall;
    // Who has picked, never what
    expect(board.content).toContain('✅ <@a>');
    expect(board.content).toContain('⏳ <@b>');
    expect(board.content).not.toContain('rock');
  });

  test('someone outside the game gets an answer and changes nothing', async () => {
    const { click, create, replies } = await startGame();
    await click('c', 'rock');
    await click('a', 'rock');
    await click('b', 'scissors');

    expect(replies[0]).toMatchObject({ id: 'c', ephemeral: true, content: expect.stringContaining('between <@a> and <@b>') });
    // c's click didn't count as a move for anyone
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('a timeout names who did not pick', async () => {
    const { click, end } = await startGame();
    await click('a', 'rock');
    await end('time');

    expect(InterActionUtils.editReply).toHaveBeenLastCalledWith(expect.anything(), {
      content: "Game cancelled: <@b> didn't pick in time.",
      components: [],
    });
  });

  test('a click after the game is decided does not play it again', async () => {
    const { click, create } = await startGame();
    await Promise.all([click('a', 'rock'), click('b', 'paper'), click('b', 'scissors')]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('shows the result as text, winner included, when the card fails', async () => {
    (cardFile as jest.Mock).mockRejectedValue(new Error('resvg'));
    const { click, create } = await startGame();
    await click('a', 'rock');
    await click('b', 'paper');

    expect(create).toHaveBeenCalledTimes(1);
    expect(InterActionUtils.editReply).toHaveBeenLastCalledWith(expect.anything(), {
      content: '<@a> chose rock, <@b> chose paper. <@b> wins!',
      components: [],
    });
  });
});

describe('astolfoMove', () => {
  test('always beats paper and scissors', () => {
    expect(astolfoMove('paper', () => 0.99)).toBe('scissors');
    expect(astolfoMove('scissors', () => 0.99)).toBe('rock');
  });

  test('wins against rock 10% of the time, otherwise plays at random', () => {
    expect(astolfoMove('rock', () => 0.05)).toBe('paper');
    const rolls = [0.5, 0.1];
    expect(astolfoMove('rock', () => rolls.shift() ?? 0)).toBe('rock');
    expect(astolfoMove('rock', () => 0.99)).toBe('scissors');
  });
});

describe('/rockpaperscissors against the bot', () => {
  test('plays on one click and saves it apart from the normal games', async () => {
    const { click, create, collector } = await startGame({ ...user('astolfo'), bot: true });
    await click('a', 'paper');

    expect(collector.stop).toHaveBeenCalledWith('played');
    expect(create).toHaveBeenCalledWith({
      data: {
        game_type: { connect: { id: 'rock-paper-scissors-astolfo' } },
        guild_id: 'g',
        metadata: { astolfoMove: 'scissors' },
        players: { create: [{ user_id: 'a', result: 0, move: 'paper' }] },
      },
    });
    expect(InterActionUtils.editReply).toHaveBeenCalledTimes(1);
  });

  test('still refuses other bots', async () => {
    await startGame({ ...user('otherbot'), bot: true });
    expect(InterActionUtils.send).toHaveBeenCalledWith(
      expect.anything(),
      { content: 'Please choose a valid user to challenge!' },
      true
    );
  });
});
