import { BUSY_MESSAGE, clearQueues, DOWN_MESSAGE, nextQuestion, toQuestion } from './opentdb';

jest.mock('../utils/logger', () => ({ Logger: { warn: jest.fn() } }));

const e = encodeURIComponent;
const raw = (n: number, type = 'multiple') => ({
  type,
  difficulty: 'hard',
  category: e('Science & Nature'),
  question: e(`What's question ${n}?`),
  correct_answer: e(type === 'boolean' ? 'False' : 'Right "one"'),
  incorrect_answers: type === 'boolean' ? ['True'] : [e('B'), e('C'), e('D')],
});
const reply = (status: number, body?: unknown) =>
  jest.fn(async () => ({ status, ok: status < 300, json: async () => body }) as Response);

beforeEach(clearQueues);

describe('toQuestion', () => {
  test('decodes every field and keeps the right answer among the answers', () => {
    const q = toQuestion(raw(1));
    expect(q).toMatchObject({ category: 'Science & Nature', difficulty: 'hard', question: "What's question 1?", correct: 'Right "one"' });
    expect([...q.answers].sort()).toEqual(['B', 'C', 'D', 'Right "one"']);
  });

  test('true/false is always True then False', () => {
    expect(toQuestion(raw(1, 'boolean'), () => 0).answers).toEqual(['True', 'False']);
  });
});

describe('nextQuestion', () => {
  test('one request gives ten questions, served in order for that guild', async () => {
    const fetchFn = reply(200, { response_code: 0, results: Array.from({ length: 10 }, (_, i) => raw(i)) });
    const first = await nextQuestion('g', fetchFn);
    const second = await nextQuestion('g', fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ ok: true, question: { question: "What's question 0?" } });
    expect(second).toMatchObject({ ok: true, question: { question: "What's question 1?" } });
  });

  test.each([
    ['unreachable', jest.fn(async () => { throw new TypeError('fetch failed'); }), DOWN_MESSAGE],
    ['a timeout', jest.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }), DOWN_MESSAGE],
    ['a 5xx', reply(503), DOWN_MESSAGE],
    ['another HTTP error', reply(404), 'Open Trivia DB returned an error (HTTP 404).'],
    ['the rate limit', reply(200, { response_code: 5, results: [] }), BUSY_MESSAGE],
    ['another response code', reply(200, { response_code: 2, results: [] }), 'Open Trivia DB returned an error (code 2).'],
  ])('%s says what went wrong', async (_case, fetchFn, message) => {
    expect(await nextQuestion('g', fetchFn as unknown as typeof fetch)).toEqual({ ok: false, message });
  });
});
