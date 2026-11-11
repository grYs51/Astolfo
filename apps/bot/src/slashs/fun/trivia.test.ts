import Trivia, { PAUSE_MS, rankScores, resultText } from './trivia';
import { InterActionUtils } from '../../utils/interaction-utils';
import { awardAndAnnounce } from '../../xp/level-up';
import { nextQuestion } from '../../trivia/opentdb';
import { cardFile } from '../../cards/render';

// Every message the command sends or edits, in order
let sent: Record<string, unknown>[] = [];
jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: {
    // Like discord.js: answering the deferred reply marks the interaction replied
    editReply: jest.fn(async (intr: { replied: boolean }, options: Record<string, unknown>) => {
      intr.replied = true;
      sent.push(options);
      return { id: 'm1' };
    }),
  },
}));
jest.mock('../../utils/logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../xp/level-up', () => ({ awardAndAnnounce: jest.fn(async () => undefined) }));
jest.mock('../../trivia/opentdb', () => ({ nextQuestion: jest.fn() }));
jest.mock('../../cards/members', () => ({ cardMembers: jest.fn(async () => ({ a: { name: 'A' }, b: { name: 'B' } })) }));
jest.mock('../../cards/render', () => ({ ...jest.requireActual('../../cards/render'), cardFile: jest.fn(async (_svg: string, name: string) => ({ name })) }));

const question = { category: 'Science', difficulty: 'hard', question: 'Q?', correct: 'Right', answers: ['Wrong', 'Right', 'Nope', 'No'] };

/** Starts a question in channel `ch` and returns ways to click an answer and to end the 20 seconds */
const start = (channelId = 'ch', options: { category?: number; difficulty?: string; rounds?: number } = {}) => {
  const handlers: Record<string, (...args: never[]) => unknown> = {};
  const collector = { on: (event: string, handler: never) => (handlers[event] = handler) };
  const create = jest.fn(async () => ({ id: 'res' }));
  const findMany = jest.fn(async () => [
    { member_id: 'a', amount: 30 },
    { member_id: 'b', amount: 20 },
  ]);
  let followUps = 0;
  const interaction = {
    id: 'int',
    guildId: 'g',
    channelId,
    replied: false,
    options: {
      getInteger: (name: string) => (name === 'rounds' ? options.rounds : options.category) ?? null,
      getString: () => options.difficulty ?? null,
    },
    editReply: jest.fn(async (o: Record<string, unknown>) => void sent.push(o)),
    followUp: jest.fn(async (o: Record<string, unknown>) => {
      sent.push(o);
      return { id: `f${++followUps}` };
    }),
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
  return { done, click, ready, create, findMany, interaction, end: () => handlers.end() };
};

const lastReply = () => sent.at(-1) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  sent = [];
  (nextQuestion as jest.Mock).mockResolvedValue({ ok: true, question });
});

describe('/trivia', () => {
  test('places follow the click order; a second click does not count; XP comes from the grant', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const game = start();
    await game.ready();
    now.mockReturnValue(2_000);
    game.click('c', 0); // wrong
    now.mockReturnValue(3_400);
    game.click('a', 1);
    const again = game.click('a', 0);
    now.mockReturnValue(5_000);
    game.click('b', 1);
    now.mockRestore();
    game.end();
    await game.done;

    expect(again.reply).toHaveBeenCalledWith({ content: 'You already answered.', ephemeral: true });
    // The buttons close as soon as time is up, before the results are worked out
    expect(InterActionUtils.editReply).toHaveBeenCalledWith(expect.anything(), { components: [expect.anything()], message: { id: 'm1' } });
    const { data } = (game.create.mock.calls[0] as unknown as [{ data: { metadata: { correctOrder: string[]; difficulty: string }; players: { create: unknown[] } } }])[0];
    expect(data.metadata).toMatchObject({ correctOrder: ['a', 'b'], difficulty: 'hard', answerMs: { c: 1000, a: 2400, b: 4000 } });
    expect(data.players.create).toEqual([
      { user_id: 'c', result: 0, move: 'Wrong' },
      { user_id: 'a', result: 1, move: 'Right' },
      { user_id: 'b', result: 1, move: 'Right' },
    ]);
    expect(awardAndAnnounce).toHaveBeenCalledTimes(2);
    expect(awardAndAnnounce).toHaveBeenCalledWith(expect.anything(), 'g', 'a', ['TRIVIA']);
    expect(lastReply()).toMatchObject({
      content: 'The answer was **Right**.\n1st <@a> 2.4 s +30 XP · 2nd <@b> 4.0 s +20 XP',
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

  test('the category and difficulty go to Open Trivia DB; without them it asks for anything', async () => {
    const game = start('filtered', { category: 17, difficulty: 'hard' });
    await game.ready();
    game.end();
    await game.done;
    expect(nextQuestion).toHaveBeenCalledWith({ category: 17, difficulty: 'hard' });
    const any = start('any');
    await any.ready();
    any.end();
    await any.done;
    expect(nextQuestion).toHaveBeenLastCalledWith({ category: undefined, difficulty: undefined });
  });

  test('a question deleted mid-round still saves its answers', async () => {
    const game = start('deleted');
    await game.ready();
    game.click('a', 1);
    // InterActionUtils swallows Unknown Message and returns nothing
    (InterActionUtils.editReply as jest.Mock).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    game.end();
    await game.done;
    expect(game.create).toHaveBeenCalledTimes(1);
    expect(awardAndAnnounce).toHaveBeenCalledWith(expect.anything(), 'g', 'a', ['TRIVIA']);
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

describe('/trivia rounds', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }));
  afterEach(() => jest.useRealTimers());

  /** Ends the current round, waits out the pause and lets the next question go out */
  const nextRound = async (game: ReturnType<typeof start>) => {
    game.end();
    await game.ready();
    await jest.advanceTimersByTimeAsync(PAUSE_MS);
    await game.ready();
  };

  test('each round is saved; the scoreboard ranks by XP, then correct answers', async () => {
    const game = start('rounds', { rounds: 3 });
    await game.ready();
    expect(lastReply().content).toBe('🎲 Trivia! Round 1/3. Hard question: ×2 XP, 20 seconds.');
    game.click('a', 1);
    game.click('b', 1);
    await nextRound(game);
    // Round 2 is a follow-up, and its result edits that message
    expect(game.interaction.followUp).toHaveBeenCalledTimes(1);
    expect(lastReply().content).toBe('🎲 Trivia! Round 2/3. Hard question: ×2 XP, 20 seconds.');
    game.click('b', 1);
    game.click('a', 0);
    await nextRound(game);
    expect(InterActionUtils.editReply).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ message: { id: 'f1' }, files: [{ name: 'trivia-result.png' }] }));
    // The channel stays taken until the game is over
    await start('rounds').done;
    expect(lastReply()).toEqual({ content: 'A question is already running here. Answer that one first!' });
    game.click('a', 0);
    game.end();
    await game.done;

    expect(game.create).toHaveBeenCalledTimes(3);
    // The grant mock gives a 30 and b 20 each time they are right: a 30, b 40
    expect(lastReply()).toMatchObject({
      content: '🏁 Final scores after 3 rounds.\n1st <@b> 2/3 +40 XP · 2nd <@a> 1/3 +30 XP',
      allowedMentions: { parse: [] },
      files: [{ name: 'trivia-scores.png' }],
    });
    // Free again
    const next = start('rounds');
    await next.ready();
    next.end();
    await next.done;
    expect(nextQuestion).toHaveBeenCalledTimes(4);
  });

  test('a round nobody answers ends the game', async () => {
    const game = start('quiet', { rounds: 5 });
    await game.ready();
    game.click('a', 1);
    await nextRound(game);
    game.end();
    await game.done;
    expect(nextQuestion).toHaveBeenCalledTimes(2);
    expect(lastReply().content).toBe('🏁 Final scores after 2 rounds. Nobody answered round 2, so the game stopped there.\n1st <@a> 1/2 +30 XP');
  });

  test('Open Trivia DB failing mid-game says so and still shows the scores', async () => {
    const game = start('flaky', { rounds: 3 });
    await game.ready();
    game.click('a', 1);
    (nextQuestion as jest.Mock).mockResolvedValueOnce({ ok: false, message: 'Open Trivia DB is down' });
    game.end();
    await game.ready();
    await jest.advanceTimersByTimeAsync(PAUSE_MS);
    await game.done;
    expect(sent.at(-2)).toEqual({ content: 'Open Trivia DB is down' });
    expect(lastReply().content).toBe('🏁 Final scores after 1 round.\n1st <@a> 1/1 +30 XP');
  });
});

describe('rankScores', () => {
  test('XP first, then correct answers, then the least time', () => {
    const board = new Map([
      ['slow', { xp: 20, correct: 2, ms: 9000 }],
      ['quick', { xp: 20, correct: 2, ms: 4000 }],
      ['top', { xp: 45, correct: 2, ms: 9000 }],
      ['many', { xp: 20, correct: 3, ms: 9000 }],
    ]);
    expect(rankScores(board).map(([id]) => id)).toEqual(['top', 'many', 'quick', 'slow']);
  });
});
