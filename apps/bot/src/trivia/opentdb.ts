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

// Ten questions per request, kept per guild: the API allows one request per 5 s per IP, so asking for one
// at a time would hit that limit far more often (a session token would cost a second request, so no token)
const queues = new Map<string, TriviaQuestion[]>();

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
  return {
    category: d(raw.category),
    difficulty: d(raw.difficulty) as TriviaDifficulty,
    question: d(raw.question),
    correct,
    answers: d(raw.type) === 'boolean' ? ['True', 'False'] : shuffle(answers, random),
  };
};

/** The next question for a guild, or a message saying why Open Trivia DB couldn't give one */
export const nextQuestion = async (guildId: string, fetchFn: typeof fetch = fetch): Promise<TriviaFetch> => {
  const queued = queues.get(guildId);
  if (queued?.length) return { ok: true, question: queued.shift() as TriviaQuestion };

  let body: { response_code: number; results: ApiQuestion[] };
  try {
    const res = await fetchFn(API, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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
  const [first, ...rest] = body.results.map((raw) => toQuestion(raw));
  queues.set(guildId, rest);
  return { ok: true, question: first };
};

/** For tests */
export const clearQueues = () => queues.clear();
