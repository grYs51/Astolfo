import type { XpLevel, XpRules } from '@nx-stolfo/api-interfaces';
import type { Db } from '../db';
import { Logger } from '../utils/logger';

export const DEFAULT_RULES: XpRules = {
  levelStep: 50,
  levelBase: 100,
  voice: {
    alone: 0.5,
    oneOther: 1,
    perExtra: 0.12,
    crowdCap: 1.5,
    deafened: 0.25,
    stayStep: 0.1,
    stayEveryMin: 30,
    stayCap: 1.5,
    camera: 0.1,
    screenShare: 0.1,
  },
  amounts: {
    voiceMinute: 1,
    starter: 15,
    message: 2,
    streakDay: 10,
    gameWin: 5,
    gameStreakStep: 2,
    gameStreakCap: 10,
    reconnect: 25,
    welcome: 20,
    milestone: 100,
    weekly: [50, 30, 20],
    trivia: [15, 10, 7, 5],
    triviaCorrect: 3,
  },
  thresholds: {
    togetherMin: 10,
    reconnectDays: 30,
    welcomeAfterDays: 30,
    startersPerDay: 3,
    milestoneHours: [10, 50, 100, 250, 500, 1000],
    triviaDailyCap: 500,
  },
  trivia: { easy: 1, medium: 1.5, hard: 2 },
};

/** XP needed to reach `level` from 0: the sum of `levelStep·L + levelBase` for L below it */
export const xpForLevel = (level: number, rules: XpRules) =>
  (rules.levelStep * level * (level - 1)) / 2 + rules.levelBase * level;

/** The level a total reaches: the largest n with xpForLevel(n) ≤ xp */
export const levelFor = (xp: number, rules: XpRules) => {
  const { levelStep: s, levelBase: b } = rules;
  if (xp <= 0) return 0;
  // s/2·n² + (b − s/2)·n − xp = 0; linear when there's no step
  const a = s / 2;
  const c = b - a;
  let n = a === 0 ? Math.floor(xp / b) : Math.floor((-c + Math.sqrt(c * c + 4 * a * xp)) / (2 * a));
  // The square root can land a hair off an exact boundary
  while (n > 0 && xpForLevel(n, rules) > xp) n--;
  while (xpForLevel(n + 1, rules) <= xp) n++;
  return n;
};

export const levelProgress = (xp: number, rules: XpRules): XpLevel => {
  const level = levelFor(xp, rules);
  return { xp, level, levelXp: xpForLevel(level, rules), nextLevelXp: xpForLevel(level + 1, rules) };
};

// ── Validation ──────────────────────────────────────────────────────────────

type Kind = 'amount' | 'multiplier' | 'count';
const LIMITS: Record<Kind, { min: number; max: number; int: boolean }> = {
  amount: { min: 0, max: 1000, int: true },
  multiplier: { min: 0, max: 5, int: false },
  count: { min: 1, max: 10000, int: true },
};

const SHAPE: Record<string, Kind | Record<string, Kind>> = {
  levelStep: 'amount',
  levelBase: 'count',
  voice: {
    alone: 'multiplier',
    oneOther: 'multiplier',
    perExtra: 'multiplier',
    crowdCap: 'multiplier',
    deafened: 'multiplier',
    stayStep: 'multiplier',
    stayEveryMin: 'count',
    stayCap: 'multiplier',
    camera: 'multiplier',
    screenShare: 'multiplier',
  },
  amounts: {
    voiceMinute: 'amount',
    starter: 'amount',
    message: 'amount',
    streakDay: 'amount',
    gameWin: 'amount',
    gameStreakStep: 'amount',
    gameStreakCap: 'amount',
    reconnect: 'amount',
    welcome: 'amount',
    milestone: 'amount',
    triviaCorrect: 'amount',
  },
  thresholds: {
    togetherMin: 'count',
    reconnectDays: 'count',
    welcomeAfterDays: 'count',
    startersPerDay: 'count',
    triviaDailyCap: 'count',
  },
  trivia: { easy: 'multiplier', medium: 'multiplier', hard: 'multiplier' },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const checkNumber = (value: unknown, kind: Kind, field: string) => {
  const { min, max, int } = LIMITS[kind];
  if (typeof value !== 'number' || !Number.isFinite(value) || (int && !Number.isInteger(value))) {
    return { field, error: `${field} must be ${int ? 'a whole number' : 'a number'}` };
  }
  if (value < min || value > max) return { field, error: `${field} must be from ${min} to ${max}` };
  return undefined;
};

/** The rules from an untrusted body, keeping only known fields, or the first error */
export const parseXpRules = (body: unknown): { rules: XpRules } | { error: string; field?: string } => {
  if (!isObject(body)) return { error: 'The rules must be an object' };
  const out: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(SHAPE)) {
    if (typeof kind === 'string') {
      const error = checkNumber(body[key], kind, key);
      if (error) return error;
      out[key] = body[key];
      continue;
    }
    const group = body[key];
    if (!isObject(group)) return { field: key, error: `${key} must be an object` };
    const copy: Record<string, unknown> = {};
    for (const [field, fieldKind] of Object.entries(kind)) {
      const error = checkNumber(group[field], fieldKind, `${key}.${field}`);
      if (error) return error;
      copy[field] = group[field];
    }
    out[key] = copy;
  }

  for (const [name, length, words] of [['weekly', 3, 'three'], ['trivia', 4, 'four']] as const) {
    const amounts = (body['amounts'] as Record<string, unknown>)[name];
    if (!Array.isArray(amounts) || amounts.length !== length) {
      return { field: `amounts.${name}`, error: `amounts.${name} must be ${words} amounts` };
    }
    for (const [i, amount] of amounts.entries()) {
      const error = checkNumber(amount, 'amount', `amounts.${name}.${i}`);
      if (error) return error;
    }
    (out['amounts'] as Record<string, unknown>)[name] = [...amounts];
  }

  const hours = (body['thresholds'] as Record<string, unknown>)['milestoneHours'];
  if (!Array.isArray(hours) || hours.length > 20) {
    return { field: 'thresholds.milestoneHours', error: 'thresholds.milestoneHours must be a list of at most 20 hours' };
  }
  for (const [i, h] of hours.entries()) {
    const error = checkNumber(h, 'count', `thresholds.milestoneHours.${i}`);
    if (error) return error;
    if (i > 0 && h <= hours[i - 1]) {
      return { field: 'thresholds.milestoneHours', error: 'thresholds.milestoneHours must rise strictly' };
    }
  }
  (out['thresholds'] as Record<string, unknown>)['milestoneHours'] = [...hours];

  return { rules: out as unknown as XpRules };
};

// ── The live set ────────────────────────────────────────────────────────────

// API and bot run in one process, so the admin PUT replacing this is all a change needs
let current: XpRules = DEFAULT_RULES;

export const currentRules = () => current;
export const setRules = (rules: XpRules | null) => {
  current = rules ?? DEFAULT_RULES;
};

/** Saved rules with any group or field added since they were saved filled in from the defaults */
const withDefaults = (saved: unknown) => {
  if (!isObject(saved)) return saved;
  const merged: Record<string, unknown> = { ...DEFAULT_RULES, ...saved };
  for (const [key, value] of Object.entries(DEFAULT_RULES)) {
    if (isObject(value) && isObject(saved[key])) merged[key] = { ...value, ...saved[key] };
  }
  return merged;
};

/** Load the saved rules at startup; a row that no longer parses (an older shape) falls back to the defaults */
export const loadRules = async (db: Pick<Db, 'xpRules'>) => {
  const row = await db.xpRules.findUnique({ where: { id: 1 } });
  if (!row) return setRules(null);
  const parsed = parseXpRules(withDefaults(row.rules));
  if ('error' in parsed) {
    Logger.warn(`Saved XP rules are invalid (${parsed.error}), using the defaults`);
    return setRules(null);
  }
  setRules(parsed.rules);
};
