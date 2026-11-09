import RockPaperScissors from './rockpaperscissors';
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
const startGame = async () => {
  const handlers: Record<string, (...args: never[]) => Promise<unknown>> = {};
  const collector = { on: (event: string, handler: never) => (handlers[event] = handler), stop: jest.fn() };
  const create = jest.fn(async () => ({}));
  const interaction = {
    id: 'int',
    guildId: 'g',
    guild: {},
    user: user('a'),
    options: { get: () => ({ user: user('b') }) },
    channel: { isSendable: () => true, createMessageComponentCollector: () => collector },
  };
  await (new RockPaperScissors() as unknown as { slash: (c: unknown, i: unknown) => Promise<void> }).slash(
    { dataSource: { gameResults: { create } } },
    interaction
  );
  const click = (id: string, move: string, deferFails = false) =>
    handlers.collect({
      user: { id },
      customId: move,
      deferUpdate: jest.fn(async () => {
        if (deferFails) throw new Error('Unknown interaction');
      }),
    } as never);
  return { click, create, collector };
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
    const [, reply] = (InterActionUtils.editReply as jest.Mock).mock.calls[0];
    expect(reply.files).toHaveLength(1);
    expect(reply.content).toBe('<@a> vs <@b>');
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
