import GeoGuess from './geoguess';
import Trivia from './trivia';
import { awardAndAnnounce } from '../../xp/level-up';
import { nextGeoQuestion } from '../../geo/mapillary';
import { nextQuestion } from '../../trivia/opentdb';
import { cardFile } from '../../cards/render';

// Every message the command sends or edits, in order
let sent: Record<string, unknown>[] = [];
jest.mock('../../utils/interaction-utils', () => ({
  InterActionUtils: {
    editReply: jest.fn(async (intr: { replied: boolean }, options: Record<string, unknown>) => {
      intr.replied = true;
      sent.push(options);
      return { id: 'm1' };
    }),
  },
}));
jest.mock('../../utils/logger', () => ({ Logger: { error: jest.fn() } }));
jest.mock('../../xp/level-up', () => ({ awardAndAnnounce: jest.fn(async () => undefined) }));
jest.mock('../../geo/mapillary', () => ({ nextGeoQuestion: jest.fn() }));
jest.mock('../../trivia/opentdb', () => ({ nextQuestion: jest.fn() }));
jest.mock('../../cards/members', () => ({ cardMembers: jest.fn(async () => ({ a: { name: 'A' } })) }));
jest.mock('../../cards/render', () => ({ ...jest.requireActual('../../cards/render'), cardFile: jest.fn(async (_svg: string, name: string) => ({ name })) }));

const question = {
  category: 'GeoGuess',
  difficulty: 'hard',
  question: 'Which country is this?',
  correct: 'Belgium',
  answers: ['France', 'Belgium', 'Japan', 'Netherlands'],
  geo: { image: 'data:image/jpeg;base64,AAAA', credit: 'walker', imageId: '42', country: 'BE', lat: 50.85, lon: 4.35, near: ['France', 'Netherlands'] },
};

const start = (Command: new () => Trivia, channelId: string, options: { difficulty?: string; rounds?: number } = {}) => {
  const handlers: Record<string, (...args: never[]) => unknown> = {};
  const createCollector = jest.fn(() => ({ on: (event: string, handler: never) => (handlers[event] = handler) }));
  const create = jest.fn(async () => ({ id: 'res' }));
  const findMany = jest.fn(async () => [
    { member_id: 'a', amount: 30 },
    { member_id: 'b', amount: 4 },
  ]);
  const interaction = {
    id: 'int',
    guildId: 'g',
    channelId,
    replied: false,
    options: {
      getInteger: (name: string) => (name === 'rounds' ? options.rounds : undefined) ?? null,
      getString: () => options.difficulty ?? null,
    },
    followUp: jest.fn(async (o: Record<string, unknown>) => {
      sent.push(o);
      return { id: `f${sent.length}` };
    }),
    channel: { isSendable: () => true, createMessageComponentCollector: createCollector },
  };
  const done = (new Command() as unknown as { slash: (c: unknown, i: unknown) => Promise<void> }).slash(
    { dataSource: { gameResults: { create }, xpEvents: { findMany } } },
    interaction
  );
  const click = (id: string, answer: number) => handlers.collect({ user: { id }, customId: `trivia:${answer}`, reply: jest.fn(async () => undefined) } as never);
  const ready = () => new Promise((resolve) => setImmediate(resolve));
  return { done, click, ready, create, findMany, createCollector, end: () => handlers.end() };
};

const lastReply = () => sent.at(-1) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  sent = [];
  (nextGeoQuestion as jest.Mock).mockResolvedValue({ ok: true, question });
});

describe('/geoguess', () => {
  test('a neighbouring country is a near miss: saved as a tie, granted, but not a place', async () => {
    const game = start(GeoGuess, 'geo', { difficulty: 'hard' });
    await game.ready();
    game.click('a', 1); // Belgium: right
    game.click('b', 0); // France: borders Belgium
    game.click('c', 2); // Japan: wrong
    game.end();
    await game.done;

    expect(nextGeoQuestion).toHaveBeenCalledWith('hard');
    // 30 seconds to look at the photo
    expect(game.createCollector).toHaveBeenCalledWith(expect.objectContaining({ time: 30_000 }));
    expect(sent[0]).toMatchObject({ content: '🌍 GeoGuess! Hard question: ×2 XP, 30 seconds.', files: [{ name: 'trivia.png' }] });

    const { data } = (game.create.mock.calls[0] as unknown as [{ data: { metadata: Record<string, unknown>; players: { create: unknown[] } } }])[0];
    expect(data.metadata).toMatchObject({ category: 'GeoGuess', correctOrder: ['a'], imageId: '42', country: 'BE', near: ['France', 'Netherlands'] });
    expect(data.metadata).not.toHaveProperty('image');
    expect(data.players.create).toEqual([
      { user_id: 'a', result: 1, move: 'Belgium' },
      { user_id: 'b', result: 2, move: 'France' },
      { user_id: 'c', result: 0, move: 'Japan' },
    ]);
    expect((awardAndAnnounce as jest.Mock).mock.calls.map((c) => c[2])).toEqual(['a', 'b']);
    expect(game.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { key: { in: ['trivia:res:a', 'trivia:res:b'] } } }));
    const content = lastReply().content as string;
    expect(content).toContain(
      'It was **Belgium**. [Map](<https://www.openstreetmap.org/?mlat=50.85&mlon=4.35#map=15/50.85/4.35>) · [Photo](<https://www.mapillary.com/app/?pKey=42>)'
    );
    expect(content).toMatch(/\n1st <@a> \d+\.\d s \+30 XP\nNear miss: <@b> \+4 XP$/);
  });

  test('the scoreboard counts a near miss as XP, not a right answer, under the GeoGuess title', async () => {
    jest.useFakeTimers();
    try {
      const game = start(GeoGuess, 'rounds', { rounds: 2 });
      for (let round = 0; round < 2; round++) {
        await jest.advanceTimersByTimeAsync(round ? 5_000 : 0);
        game.click('b', 0);
        game.end();
      }
      await jest.runAllTimersAsync();
      await game.done;
      expect(lastReply().content).toBe('🏁 Final scores after 2 rounds.\n1st <@b> 0/2 +8 XP');
    } finally {
      jest.useRealTimers();
    }
  });

  test('when the card fails, the photo goes out on its own, and the question never links the photo page (it shows the pin)', async () => {
    (cardFile as jest.Mock).mockRejectedValueOnce(new Error('resvg'));
    const game = start(GeoGuess, 'no-card');
    await game.ready();
    game.end();
    await game.done;
    const asked = sent[0] as { content: string; files: { name: string; attachment: Buffer }[] };
    expect(asked.files).toEqual([{ name: 'geoguess.jpg', attachment: Buffer.from('AAAA', 'base64') }]);
    expect(asked.content).toContain('Photo on Mapillary, CC BY-SA 4.0');
    expect(asked.content).not.toContain('walker');
    expect(asked.content).not.toContain('pKey');
  });

  test('one game per channel: a GeoGuess blocks a /trivia there', async () => {
    const geo = start(GeoGuess, 'shared');
    await geo.ready();
    await start(Trivia, 'shared').done;
    expect(lastReply()).toEqual({ content: 'A question is already running here. Answer that one first!' });
    expect(nextQuestion).not.toHaveBeenCalled();
    geo.end();
    await geo.done;
  });

  test('when Mapillary is down it says so, saves nothing and frees the channel', async () => {
    (nextGeoQuestion as jest.Mock).mockResolvedValueOnce({ ok: false, message: 'Mapillary is down' });
    const game = start(GeoGuess, 'down');
    await game.done;
    expect(lastReply()).toEqual({ content: 'Mapillary is down' });
    expect(game.create).not.toHaveBeenCalled();

    const next = start(GeoGuess, 'down');
    await next.ready();
    next.end();
    await next.done;
    expect(nextGeoQuestion).toHaveBeenCalledTimes(2);
  });
});
