import { BUSY_MESSAGE, CATEGORIES, clearQueue, DOWN_MESSAGE, nextQuestion, NO_RESULTS_MESSAGE, toQuestion } from './opentdb';

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

beforeEach(clearQueue);

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
  test('one request gives ten questions, served in order', async () => {
    const fetchFn = reply(200, { response_code: 0, results: Array.from({ length: 10 }, (_, i) => raw(i)) });
    const first = await nextQuestion({}, fetchFn);
    const second = await nextQuestion({}, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ ok: true, question: { question: "What's question 0?" } });
    expect(second).toMatchObject({ ok: true, question: { question: "What's question 1?" } });
  });

  test.each([
    ['unreachable', jest.fn(async () => { throw new TypeError('fetch failed'); }), DOWN_MESSAGE],
    ['a timeout', jest.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); }), DOWN_MESSAGE],
    ['a 5xx', reply(503), DOWN_MESSAGE],
    ['another HTTP error', reply(404), 'Open Trivia DB returned an error (HTTP 404).'],
    ['the rate limit (HTTP 429)', reply(429, { response_code: 5, results: [] }), BUSY_MESSAGE],
    ['the rate limit code on a 200', reply(200, { response_code: 5, results: [] }), BUSY_MESSAGE],
    ['too few questions for the filter', reply(200, { response_code: 1, results: [] }), NO_RESULTS_MESSAGE],
    ['another response code', reply(200, { response_code: 2, results: [] }), 'Open Trivia DB returned an error (code 2).'],
  ])('%s says what went wrong', async (_case, fetchFn, message) => {
    expect(await nextQuestion({}, fetchFn as unknown as typeof fetch)).toEqual({ ok: false, message });
  });
});

describe('questions asked at the same time', () => {
  test('share one request and get different questions', async () => {
    const fetchFn = reply(200, { response_code: 0, results: Array.from({ length: 10 }, (_, i) => raw(i)) });
    const [a, b] = await Promise.all([nextQuestion({}, fetchFn), nextQuestion({}, fetchFn)]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(a.ok && b.ok && a.question.question !== b.question.question).toBe(true);
  });

  test('an unknown difficulty counts as easy', () => {
    expect(toQuestion({ ...raw(1), difficulty: 'legendary' }).difficulty).toBe('easy');
  });
});

describe('filters', () => {
  const ten = () => reply(200, { response_code: 0, results: Array.from({ length: 10 }, (_, i) => raw(i)) });
  const url = (fetchFn: jest.Mock, call = 0) => fetchFn.mock.calls[call][0] as string;

  test('go in the URL; no filter asks for anything', async () => {
    const fetchFn = ten();
    await nextQuestion({ category: 17, difficulty: 'hard' }, fetchFn);
    expect(url(fetchFn)).toBe('https://opentdb.com/api.php?amount=10&encode=url3986&category=17&difficulty=hard');
    clearQueue();
    await nextQuestion({}, fetchFn);
    expect(url(fetchFn, 1)).toBe('https://opentdb.com/api.php?amount=10&encode=url3986');
  });

  test('each filter has its own queue, and a second request waits until 5 s have passed', async () => {
    jest.useFakeTimers();
    try {
      const fetchFn = ten();
      await nextQuestion({ category: 9 }, fetchFn);
      const other = nextQuestion({ category: 10 }, fetchFn);
      await jest.advanceTimersByTimeAsync(4900);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(100);
      expect(await other).toMatchObject({ ok: true });
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(url(fetchFn, 1)).toContain('&category=10');
      // Category 9 still has nine questions queued, so no request
      await nextQuestion({ category: 9 }, fetchFn);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('the categories fit in Discord choices', () => {
    expect(CATEGORIES).toHaveLength(24);
    expect(new Set(CATEGORIES.map((c) => c.value)).size).toBe(24);
  });
});
