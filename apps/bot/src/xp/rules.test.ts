import { DEFAULT_RULES, currentRules, levelFor, loadRules, parseXpRules, setRules, xpForLevel } from './rules';

const withRules = (patch: object) => JSON.parse(JSON.stringify({ ...DEFAULT_RULES, ...patch }));

describe('levels', () => {
  test.each([
    [0, 0],
    [99, 0],
    [100, 1],
    [249, 1],
    [250, 2],
    [3249, 9],
    [3250, 10],
    [11_500, 20],
    [11_499, 19],
  ])('%i XP is level %i under the defaults', (xp, level) => {
    expect(levelFor(xp, DEFAULT_RULES)).toBe(level);
  });

  test('xpForLevel matches 25n² + 75n under the defaults', () => {
    for (const n of [0, 1, 7, 10, 20, 50]) expect(xpForLevel(n, DEFAULT_RULES)).toBe(25 * n * n + 75 * n);
  });

  test('a custom curve', () => {
    const rules = withRules({ levelStep: 10, levelBase: 30 });
    // 30, 40, 50: level 3 at 120
    expect(levelFor(119, rules)).toBe(2);
    expect(levelFor(120, rules)).toBe(3);
  });

  test('no step is linear', () => {
    const rules = withRules({ levelStep: 0, levelBase: 100 });
    expect(levelFor(0, rules)).toBe(0);
    expect(levelFor(999, rules)).toBe(9);
    expect(levelFor(1000, rules)).toBe(10);
  });
});

describe('parseXpRules', () => {
  test('the defaults pass', () => {
    expect(parseXpRules(DEFAULT_RULES)).toEqual({ rules: DEFAULT_RULES });
  });

  test('turns down a negative amount', () => {
    const body = withRules({});
    body.amounts.message = -1;
    expect(parseXpRules(body)).toEqual({ field: 'amounts.message', error: expect.stringMatching(/from 0 to 1000/) });
  });

  test('turns down a levelBase of 0', () => {
    expect(parseXpRules(withRules({ levelBase: 0 }))).toMatchObject({ field: 'levelBase' });
  });

  test('turns down milestone hours out of order', () => {
    const body = withRules({});
    body.thresholds.milestoneHours = [10, 50, 50];
    expect(parseXpRules(body)).toMatchObject({ field: 'thresholds.milestoneHours' });
  });

  test('turns down a multiplier over 5 and a missing group', () => {
    const body = withRules({});
    body.voice.crowdCap = 6;
    expect(parseXpRules(body)).toMatchObject({ field: 'voice.crowdCap' });
    expect(parseXpRules({ ...DEFAULT_RULES, voice: undefined })).toMatchObject({ field: 'voice' });
  });

  test('drops unknown fields', () => {
    const parsed = parseXpRules({ ...DEFAULT_RULES, extra: 1 });
    expect(parsed).toEqual({ rules: DEFAULT_RULES });
  });
});

describe('trivia rules', () => {
  test('trivia needs four amounts and multipliers in range', () => {
    expect(parseXpRules(withRules({ amounts: { ...DEFAULT_RULES.amounts, trivia: [15, 10, 7] } }))).toEqual({
      field: 'amounts.trivia',
      error: 'amounts.trivia must be four amounts',
    });
    expect(parseXpRules(withRules({ trivia: { easy: 1, medium: 1.5, hard: 6 } }))).toMatchObject({ field: 'trivia.hard' });
    expect(parseXpRules(withRules({}))).toEqual({ rules: DEFAULT_RULES });
  });

  test('rules saved before trivia existed keep their values and get the trivia defaults', async () => {
    const { trivia: _multipliers, ...older } = JSON.parse(JSON.stringify(DEFAULT_RULES));
    delete older.amounts.trivia;
    delete older.amounts.triviaCorrect;
    delete older.amounts.triviaNear;
    delete older.thresholds.triviaDailyCap;
    older.amounts.message = 7;
    await loadRules({ xpRules: { findUnique: async () => ({ rules: older }) } } as never);
    expect(currentRules()).toEqual({ ...DEFAULT_RULES, amounts: { ...DEFAULT_RULES.amounts, message: 7 } });
    setRules(null);
  });
});
