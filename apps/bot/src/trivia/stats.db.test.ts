import { PrismaClient } from '@prisma/client';
import { getTriviaStats } from './stats';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';

jest.mock('../client/instance', () => ({ client: {} }));

// Runs against a real Postgres only when XP_TEST_DATABASE_URL points at one with the migrations applied, like
// xp/grant.db.test.ts. It works in its own guild ids and deletes its rows before and after.
const url = process.env.XP_TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

const G = 'trivia-test-guild';
const OTHER = 'trivia-test-other';

describeDb('getTriviaStats', () => {
  const db = url ? new PrismaClient({ datasources: { db: { url } } }) : (undefined as unknown as PrismaClient);

  /** One saved question: each player with whether they were right and their time (none for old rows) */
  const question = (category: string, players: [string, boolean, number?][], guild = G) => {
    const correctOrder = players.filter(([, right]) => right).sort(([, , a], [, , b]) => (a ?? 0) - (b ?? 0)).map(([id]) => id);
    const timed = players.filter(([, , ms]) => ms !== undefined);
    return db.game_result.create({
      data: {
        game_type: { connect: { id: GAME_TYPES.TRIVIA } },
        guild_id: guild,
        metadata: {
          question: 'Q?',
          category,
          difficulty: 'easy',
          correct: 'A',
          correctOrder,
          ...(timed.length && { answerMs: Object.fromEntries(timed.map(([id, , ms]) => [id, ms])) }),
        },
        players: { create: players.map(([user_id, right]) => ({ user_id, result: right ? SCORING.WIN : SCORING.LOSS, move: right ? 'A' : 'B' })) },
      },
    });
  };

  const clean = async () => {
    for (const guild of [G, OTHER]) {
      await db.xp_events.deleteMany({ where: { guild_id: guild } });
      await db.game_player.deleteMany({ where: { game_result: { guild_id: guild } } });
      await db.game_result.deleteMany({ where: { guild_id: guild } });
    }
  };

  beforeAll(async () => {
    await clean();
    await db.game_type.upsert({ where: { id: GAME_TYPES.TRIVIA }, update: {}, create: { id: GAME_TYPES.TRIVIA, name: 'Trivia' } });
    // Science: 4 of 6 right, two of them 1st (tb is slower there)
    await question('Science', [['ta', true, 3000], ['tb', true, 4000]]);
    await question('Science', [['ta', true, 1500]]);
    await question('Science', [['tb', true, 1000], ['ta', true, 5000]]);
    await question('Science', [['ta', true, 2500], ['tb', false, 900]]);
    // A quick wrong answer doesn't count as the quickest
    await question('Science', [['ta', false, 800]]);
    await question('Science', [['ta', false, 6000]]);
    // History: also 4 right, of 5: the better accuracy wins the tie
    for (let i = 0; i < 5; i++) await question('History', [['tb', true, 500], ['ta', i < 4, 7000]]);
    // Art: 2 of 2, but too few to count
    await question('Art', [['ta', true, 2000]]);
    await question('Art', [['ta', true, 2200]]);
    // Saved before times were kept
    await question('Art', [['ta', true]]);
    // Another server
    await question('Science', [['ta', true, 100]], OTHER);

    await db.xp_events.createMany({
      data: [
        { guild_id: G, member_id: 'ta', source: 'TRIVIA', amount: 30, note: 'Trivia: 1st', key: 'trivia:t1:ta', created_at: new Date() },
        { guild_id: G, member_id: 'ta', source: 'TRIVIA', amount: 20, note: 'Trivia: 2nd', key: 'trivia:t2:ta', created_at: new Date() },
        { guild_id: G, member_id: 'ta', source: 'GAME', amount: 99, note: 'Game', key: 'game:t3:ta', created_at: new Date() },
        { guild_id: OTHER, member_id: 'ta', source: 'TRIVIA', amount: 77, note: 'Trivia: 1st', key: 'trivia:t4:ta', created_at: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await clean();
    await db.$disconnect();
  });

  test('counts answers, right answers, 1st places, XP, the quickest right answer and the best category', async () => {
    expect(await getTriviaStats(db as never, G, 'ta')).toEqual({
      answered: 14,
      correct: 11,
      // Science 3 (3000 beats tb's 4000, 1500 alone, 2500 next to a wrong tb) and the three Art questions
      firsts: 6,
      xp: 50,
      fastestMs: 1500,
      bestCategory: { name: 'History', answered: 5, correct: 4 },
    });
  });

  test('a member with no answers gets zeros', async () => {
    expect(await getTriviaStats(db as never, G, 'nobody')).toEqual({ answered: 0, correct: 0, firsts: 0, xp: 0, fastestMs: undefined, bestCategory: undefined });
  });
});
