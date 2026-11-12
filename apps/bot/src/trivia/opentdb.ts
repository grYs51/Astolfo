import { Logger } from '../utils/logger';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

export interface TriviaQuestion {
  category: string;
  difficulty: TriviaDifficulty;
  question: string;
  correct: string;
  /** Shuffled for a multiple-choice question; True then False for a true/false one */
  answers: string[];
}

export type TriviaFetch = { ok: true; question: TriviaQuestion } | { ok: false; message: string };

/** What `/trivia` can ask for; nothing set means any question */
export interface TriviaFilter {
  category?: number;
  difficulty?: TriviaDifficulty;
}

/** Open Trivia DB's categories (api_category.php, checked 2026-11-12): 24 fit Discord's 25 static choices */
export const CATEGORIES: { name: string; value: number }[] = [
  ['General Knowledge', 9],
  ['Books', 10],
  ['Film', 11],
  ['Music', 12],
  ['Musicals & Theatres', 13],
  ['Television', 14],
  ['Video Games', 15],
  ['Board Games', 16],
  ['Science & Nature', 17],
  ['Computers', 18],
  ['Mathematics', 19],
  ['Mythology', 20],
  ['Sports', 21],
  ['Geography', 22],
  ['History', 23],
  ['Politics', 24],
  ['Art', 25],
  ['Celebrities', 26],
  ['Animals', 27],
  ['Vehicles', 28],
  ['Comics', 29],
  ['Gadgets', 30],
  ['Japanese Anime & Manga', 31],
  ['Cartoons & Animations', 32],
].map(([name, value]) => ({ name: name as string, value: value as number }));

interface ApiQuestion {
  type: string;
  difficulty: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

const API = 'https://opentdb.com/api.php?encode=url3986';
const TIMEOUT_MS = 5000;
/** The API allows one request per 5 s per IP, for every filter together */
const GAP_MS = 5000;

export const DOWN_MESSAGE =
  "🔌 Open Trivia DB (opentdb.com) is down or not responding right now, so I can't ask a question. Try again later.";
export const BUSY_MESSAGE = 'Open Trivia DB is busy. Try again in a few seconds.';
export const NO_RESULTS_MESSAGE = "Open Trivia DB doesn't have enough questions for that category and difficulty. Try another.";

// Ten questions per request, in one queue per filter for every server: the API allows one request per 5 s per
// IP, so asking for one at a time would hit that limit far more often (a session token would cost a second
// request). Questions asked while a request for the same filter is out wait for it instead of sending another,
// and every request waits until 5 s have passed since the previous one.
const queues = new Map<string, TriviaQuestion[]>();
const inFlight = new Map<string, Promise<TriviaFetch>>();
let chain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
const DIFFICULTIES: TriviaDifficulty[] = ['easy', 'medium', 'hard'];

const shuffle = <T>(items: T[], random: () => number) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const toQuestion = (raw: ApiQuestion, random = Math.random): TriviaQuestion => {
  const d = decodeURIComponent;
  const correct = d(raw.correct_answer);
  const answers = [correct, ...raw.incorrect_answers.map(d)];
  const difficulty = d(raw.difficulty) as TriviaDifficulty;
  return {
    category: d(raw.category),
    // Anything unexpected counts as easy, the same as the XP grant does
    difficulty: DIFFICULTIES.includes(difficulty) ? difficulty : 'easy',
    question: d(raw.question),
    correct,
    answers: d(raw.type) === 'boolean' ? ['True', 'False'] : shuffle(answers, random),
  };
};

/** Runs `fn` once 5 s have passed since the previous request, one request at a time */
const spaced = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(async () => {
    const wait = lastRequestAt + GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
};

/** The next question, or a message saying why Open Trivia DB couldn't give one */
export const nextQuestion = async (filter: TriviaFilter = {}, fetchFn: typeof fetch = fetch): Promise<TriviaFetch> => {
  const key = `${filter.category ?? ''}:${filter.difficulty ?? ''}`;
  const queue = queues.get(key) ?? [];
  queues.set(key, queue);
  const queued = queue.shift();
  if (queued) return { ok: true, question: queued };
  let request = inFlight.get(key);
  if (!request) {
    request = spaced(() => fetchBatch(filter, queue, fetchFn)).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  const fetched = await request;
  if (!fetched.ok) return fetched;
  // Everyone who waited shares the batch; if it ran out, ask again
  const question = queue.shift();
  return question ? { ok: true, question } : nextQuestion(filter, fetchFn);
};

/** Fills `queue` with ten questions for `filter` (five with a category) */
const fetchBatch = async (filter: TriviaFilter, queue: TriviaQuestion[], fetchFn: typeof fetch): Promise<TriviaFetch> => {
  // The API refuses (code 1) when it has fewer than `amount` for the filter, and some categories are small
  // shortcut: assumes 5+ per category and difficulty (the smallest, Gadgets hard, had 6 on 2026-11-12); a smaller one says "not enough"
  const amount = filter.category ? 5 : 10;
  const url = `${API}&amount=${amount}` + (filter.category ? `&category=${filter.category}` : '') + (filter.difficulty ? `&difficulty=${filter.difficulty}` : '');
  let body: { response_code: number; results: ApiQuestion[] };
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // The rate limit comes as HTTP 429 (with response_code 5)
    if (res.status === 429) return { ok: false, message: BUSY_MESSAGE };
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) {
      Logger.warn(`Open Trivia DB answered HTTP ${res.status}`);
      return { ok: false, message: `Open Trivia DB returned an error (HTTP ${res.status}).` };
    }
    body = await res.json();
  } catch (error) {
    Logger.warn(`Open Trivia DB is unreachable: ${error instanceof Error ? error.message : error}`);
    return { ok: false, message: DOWN_MESSAGE };
  }

  if (body.response_code === 5) return { ok: false, message: BUSY_MESSAGE };
  if (body.response_code === 1) return { ok: false, message: NO_RESULTS_MESSAGE };
  if (body.response_code !== 0 || !body.results?.length) {
    Logger.warn(`Open Trivia DB returned response code ${body.response_code}`);
    return { ok: false, message: `Open Trivia DB returned an error (code ${body.response_code}).` };
  }
  queue.push(...body.results.map((raw) => toQuestion(raw)));
  return { ok: true, question: queue[0] };
};

/** For tests */
export const clearQueue = () => {
  queues.clear();
  lastRequestAt = 0;
};
