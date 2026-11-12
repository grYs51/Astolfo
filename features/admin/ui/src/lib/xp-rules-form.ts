import type { XpRules } from '@nx-stolfo/data-access-admin';

export interface XpRuleField {
  /** Dotted path into XpRules, as the API's 400 names it */
  path: string;
  label: string;
  /** Input step: 1 for whole numbers */
  step: number;
}

const f = (path: string, label: string, step = 1): XpRuleField => ({ path, label, step });

/** The form, grouped like the plan: what each number does, in the order shown */
export const XP_RULE_GROUPS: { title: string; hint: string; fields: XpRuleField[] }[] = [
  {
    title: 'Levels',
    hint: 'Level L to L+1 costs step × L + base XP. A new curve moves every level at once.',
    fields: [f('levelStep', 'Step per level'), f('levelBase', 'Base cost')],
  },
  {
    title: 'Voice multipliers',
    hint: 'A voice minute earns minute XP × crowd × deafened × stay × media.',
    fields: [
      f('voice.alone', 'Alone', 0.01),
      f('voice.oneOther', 'With one other', 0.01),
      f('voice.perExtra', 'Per extra person', 0.01),
      f('voice.crowdCap', 'Crowd cap', 0.01),
      f('voice.deafened', 'Deafened', 0.01),
      f('voice.stayStep', 'Stay step', 0.01),
      f('voice.stayEveryMin', 'Stay step every (min)'),
      f('voice.stayCap', 'Stay cap', 0.01),
      f('voice.camera', 'Camera bonus', 0.01),
      f('voice.screenShare', 'Screen share bonus', 0.01),
    ],
  },
  {
    title: 'Sources',
    hint: 'XP per grant. 0 turns a source off.',
    fields: [
      f('amounts.voiceMinute', 'Voice minute'),
      f('amounts.message', 'Message (one a minute)'),
      f('amounts.streakDay', 'Streak day'),
      f('amounts.gameWin', 'Game win'),
      f('amounts.gameStreakStep', 'Per win in a row'),
      f('amounts.gameStreakCap', 'Win streak cap'),
      f('amounts.starter', 'Started a call'),
      f('amounts.reconnect', 'Reconnect'),
      f('amounts.welcome', 'Welcome'),
      f('amounts.milestone', 'Voice-hour milestone'),
      f('amounts.weekly.0', 'Weekly #1'),
      f('amounts.weekly.1', 'Weekly #2'),
      f('amounts.weekly.2', 'Weekly #3'),
    ],
  },
  {
    title: 'Trivia',
    hint: 'The quickest right answers earn the most, times the difficulty multiplier. A GeoGuess near miss is a neighbouring country. XP stops at the daily cap.',
    fields: [
      f('amounts.trivia.0', 'Trivia 1st'),
      f('amounts.trivia.1', 'Trivia 2nd'),
      f('amounts.trivia.2', 'Trivia 3rd'),
      f('amounts.trivia.3', 'Trivia 4th'),
      f('amounts.triviaCorrect', 'Every later right answer'),
      f('amounts.triviaNear', 'Near miss (GeoGuess)'),
      f('trivia.easy', 'Easy ×', 0.01),
      f('trivia.medium', 'Medium ×', 0.01),
      f('trivia.hard', 'Hard ×', 0.01),
      f('thresholds.triviaDailyCap', 'Daily cap per member'),
    ],
  },
  {
    title: 'Thresholds',
    hint: 'When the bonuses count.',
    fields: [
      f('thresholds.togetherMin', 'Minutes together'),
      f('thresholds.reconnectDays', 'Days apart for a reconnect'),
      f('thresholds.welcomeAfterDays', 'Days of tracking before welcome'),
      f('thresholds.startersPerDay', 'Starter bonuses a day'),
    ],
  },
];

/** The milestone hours are a list, typed as text */
export const MILESTONE_PATH = 'thresholds.milestoneHours';

export const getRule = (rules: XpRules, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], rules);

/** A copy of `rules` with one value replaced */
export const setRule = (rules: XpRules, path: string, value: unknown): XpRules => {
  const copy = structuredClone(rules);
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce<Record<string, unknown>>((obj, key) => obj[key] as Record<string, unknown>, copy as never);
  parent[keys[keys.length - 1]] = value;
  return copy;
};

/** "10, 50, 100" → [10, 50, 100]; anything unreadable stays NaN so the API names it */
export const parseHours = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);

/** XP needed for each level under the rules being typed, the same formula as the bot */
export const levelsPreview = (rules: XpRules, levels = [10, 20, 50]) =>
  levels.map((level) => ({ level, xp: (rules.levelStep * level * (level - 1)) / 2 + rules.levelBase * level }));

/** What Save sends: null when the draft is the defaults, so later changes to the defaults in code apply */
export const saveBody = (draft: XpRules, defaults: XpRules): XpRules | null =>
  JSON.stringify(draft) === JSON.stringify(defaults) ? null : draft;
