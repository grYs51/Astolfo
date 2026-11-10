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

interface ApiQuestion {
  type: string;
  difficulty: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

const API = 'https://opentdb.com/api.php?amount=10&encode=url3986';
const TIMEOUT_MS = 5000;

export const DOWN_MESSAGE =
  "🔌 Open Trivia DB (opentdb.com) is down or not responding right now, so I can't ask a question. Try again later.";
export const BUSY_MESSAGE = 'Open Trivia DB is busy. Try again in a few seconds.';

// Ten questions per request, in one queue for every server: the API allows one request per 5 s per IP, so
// asking for one at a time would hit that limit far more often (a session token would cost a second request).
// Questions asked while a request is out wait for it instead of sending another.
let queue: TriviaQuestion[] = [];
let inFlight: Promise<TriviaFetch> | undefined;
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

/** The next question, or a message saying why Open Trivia DB couldn't give one */
export const nextQuestion = async (fetchFn: typeof fetch = fetch): Promise<TriviaFetch> => {
  const queued = queue.shift();
  if (queued) return { ok: true, question: queued };
  inFlight ??= fetchBatch(fetchFn).finally(() => (inFlight = undefined));
  const fetched = await inFlight;
  if (!fetched.ok) return fetched;
  // Everyone who waited shares the batch; if it ran out, ask again
  const question = queue.shift();
  return question ? { ok: true, question } : nextQuestion(fetchFn);
};

/** Fills the queue with ten questions */
const fetchBatch = async (fetchFn: typeof fetch): Promise<TriviaFetch> => {
  let body: { response_code: number; results: ApiQuestion[] };
  try {
    const res = await fetchFn(API, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  if (body.response_code !== 0 || !body.results?.length) {
    Logger.warn(`Open Trivia DB returned response code ${body.response_code}`);
    return { ok: false, message: `Open Trivia DB returned an error (code ${body.response_code}).` };
  }
  queue.push(...body.results.map((raw) => toQuestion(raw)));
  return { ok: true, question: queue[0] };
};

/** For tests */
export const clearQueue = () => {
  queue = [];
};
