import Trivia, { resultText } from './trivia';
import { InterActionUtils } from '../../utils/interaction-utils';
import { awardAndAnnounce } from '../../xp/level-up';
import { nextQuestion } from '../../trivia/opentdb';
import { cardFile } from '../../cards/render';

jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: { editReply: jest.fn(async () => undefined) },
}));
jest.mock('../../utils/logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../xp/level-up', () => ({ awardAndAnnounce: jest.fn(async () => undefined) }));
jest.mock('../../trivia/opentdb', () => ({ nextQuestion: jest.fn() }));
jest.mock('../../cards/members', () => ({ cardMembers: jest.fn(async () => ({ a: { name: 'A' }, b: { name: 'B' } })) }));
jest.mock('../../cards/render', () => ({ ...jest.requireActual('../../cards/render'), cardFile: jest.fn(async (_svg: string, name: string) => ({ name })) }));

const question = { category: 'Science', difficulty: 'hard', question: 'Q?', correct: 'Right', answers: ['Wrong', 'Right', 'Nope', 'No'] };

/** Starts a question in channel `ch` and returns ways to click an answer and to end the 20 seconds */
const start = (channelId = 'ch') => {
  const handlers: Record<string, (...args: never[]) => unknown> = {};
  const collector = { on: (event: string, handler: never) => (handlers[event] = handler) };
  const create = jest.fn(async () => ({ id: 'res' }));
  const findMany = jest.fn(async () => [
    { member_id: 'a', amount: 30 },
    { member_id: 'b', amount: 20 },
  ]);
  const interaction = {
    id: 'int',
    guildId: 'g',
    channelId,
    channel: { isSendable: () => true, createMessageComponentCollector: () => collector },
  };
  const done = (new Trivia() as unknown as { slash: (c: unknown, i: unknown) => Promise<void> }).slash(
    { dataSource: { gameResults: { create }, xpEvents: { findMany } } },
    interaction
  );
  const click = (id: string, answer: number) => {
    const i = { user: { id }, customId: `trivia:${answer}`, reply: jest.fn(async () => undefined) };
    handlers.collect(i as never);
    return i;
  };
  // Lets slash() reach the collector before the test clicks
  const ready = () => new Promise((resolve) => setImmediate(resolve));
  return { done, click, ready, create, findMany, end: () => handlers.end() };
};

const lastReply = () => (InterActionUtils.editReply as jest.Mock).mock.calls.at(-1)[1];

beforeEach(() => {
  jest.clearAllMocks();
  (nextQuestion as jest.Mock).mockResolvedValue({ ok: true, question });
});

describe('/trivia', () => {
  test('places follow the click order; a second click does not count; XP comes from the grant', async () => {
    const game = start();
    await game.ready();
    game.click('c', 0); // wrong
    game.click('a', 1);
    const again = game.click('a', 0);
    game.click('b', 1);
    game.end();
    await game.done;

    expect(again.reply).toHaveBeenCalledWith({ content: 'You already answered.', ephemeral: true });
    // The buttons close as soon as time is up, before the results are worked out
    expect(InterActionUtils.editReply).toHaveBeenCalledWith(expect.anything(), { components: [expect.anything()] });
    const { data } = (game.create.mock.calls[0] as unknown as [{ data: { metadata: { correctOrder: string[]; difficulty: string }; players: { create: unknown[] } } }])[0];
    expect(data.metadata).toMatchObject({ correctOrder: ['a', 'b'], difficulty: 'hard' });
    expect(data.players.create).toEqual([
      { user_id: 'c', result: 0, move: 'Wrong' },
      { user_id: 'a', result: 1, move: 'Right' },
      { user_id: 'b', result: 1, move: 'Right' },
    ]);
    expect(awardAndAnnounce).toHaveBeenCalledTimes(2);
    expect(awardAndAnnounce).toHaveBeenCalledWith(expect.anything(), 'g', 'a', ['TRIVIA']);
    expect(lastReply()).toMatchObject({
      content: 'The answer was **Right**.\n1st <@a> +30 XP · 2nd <@b> +20 XP',
      allowedMentions: { parse: [] },
      files: [{ name: 'trivia-result.png' }],
    });
  });

  test('one question at a time per channel', async () => {
    const first = start('busy');
    await first.ready();
    await start('busy').done;
    expect(lastReply()).toEqual({ content: 'A question is already running here. Answer that one first!' });
    first.end();
    await first.done;
    // Free again once it's over
    const next = start('busy');
    await next.ready();
    next.end();
    await next.done;
    expect(nextQuestion).toHaveBeenCalledTimes(2);
  });

  test('when Open Trivia DB is down it says so, saves nothing and frees the channel', async () => {
    (nextQuestion as jest.Mock).mockResolvedValueOnce({ ok: false, message: 'Open Trivia DB is down' });
    const game = start('down');
    await game.done;
    expect(lastReply()).toEqual({ content: 'Open Trivia DB is down' });
    expect(game.create).not.toHaveBeenCalled();

    const next = start('down');
    await next.ready();
    next.end();
    await next.done;
    expect(nextQuestion).toHaveBeenCalledTimes(2);
  });

  test('nobody answering saves nothing and grants nothing', async () => {
    const game = start();
    await game.ready();
    game.end();
    await game.done;
    expect(game.create).not.toHaveBeenCalled();
    expect(awardAndAnnounce).not.toHaveBeenCalled();
    expect(lastReply().content).toBe('The answer was **Right**. Nobody answered!');
  });

  test('the question still goes out as text when its card fails to draw', async () => {
    (cardFile as jest.Mock).mockRejectedValueOnce(new Error('resvg'));
    const game = start();
    await game.ready();
    expect(lastReply()).toMatchObject({
      content: '🎲 Trivia! Hard question: ×2 XP, 20 seconds.\n**Q?**\n-# Question from Open Trivia DB (opentdb.com), CC BY-SA 4.0',
      allowedMentions: { parse: [] },
    });
    expect(lastReply().files).toBeUndefined();
    game.end();
    await game.done;
  });

  test('Markdown in an answer from Open Trivia DB is escaped', () => {
    const nsync = { ...question, correct: '*NSYNC' } as never;
    expect(resultText(nsync, 0, [], new Map())).toBe('The answer was **\\*NSYNC**. Nobody answered!');
  });
});
