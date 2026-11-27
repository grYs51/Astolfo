import type { XpRules } from '@nx-stolfo/data-access-admin';
import { getRule, levelsPreview, parseHours, saveBody, setRule, simulateGeoguess, XP_RULE_GROUPS } from './xp-rules-form';

const DEFAULTS: XpRules = {
  levelStep: 50,
  levelBase: 100,
  voice: { alone: 0.5, oneOther: 1, perExtra: 0.12, crowdCap: 1.5, deafened: 0.25, stayStep: 0.1, stayEveryMin: 30, stayCap: 1.5, camera: 0.1, screenShare: 0.1 },
  amounts: { voiceMinute: 1, starter: 15, message: 2, streakDay: 10, gameWin: 5, gameStreakStep: 2, gameStreakCap: 10, reconnect: 25, welcome: 20, milestone: 100, weekly: [50, 30, 20], trivia: [15, 10, 7, 5], triviaCorrect: 3, triviaNear: 2 },
  thresholds: { togetherMin: 10, reconnectDays: 30, welcomeAfterDays: 30, startersPerDay: 3, milestoneHours: [10, 50, 100, 250, 500, 1000], triviaDailyCap: 500 },
  trivia: { easy: 1, medium: 1.5, hard: 2 },
  geoguess: {
    pin: 15,
    radiusEasy: 2000,
    radiusMedium: 1000,
    radiusHard: 500,
    fullKmEasy: 400,
    fullKmMedium: 200,
    fullKmHard: 100,
    closest: 3,
    perPlayer: 3,
    crowdCap: 6,
    unsentEasy: 1,
    unsentMedium: 0.75,
    unsentHard: 0.5,
  },
};

describe('the XP rules form', () => {
  it('the levels preview follows the values being typed', () => {
    expect(levelsPreview(DEFAULTS)).toEqual([
      { level: 10, xp: 3250 },
      { level: 20, xp: 11_500 },
      { level: 50, xp: 66_250 },
    ]);
    const typed = setRule(setRule(DEFAULTS, 'levelStep', 0), 'levelBase', 200);
    expect(levelsPreview(typed).map((l) => l.xp)).toEqual([2000, 4000, 10_000]);
  });

  it('every field reads and writes its own value, the original untouched', () => {
    for (const field of XP_RULE_GROUPS.flatMap((g) => g.fields)) {
      expect(typeof getRule(DEFAULTS, field.path)).toBe('number');
      expect(getRule(setRule(DEFAULTS, field.path, 7), field.path)).toBe(7);
    }
    expect(DEFAULTS.amounts.weekly).toEqual([50, 30, 20]);
  });

  it('reset to the defaults saves null, so the defaults in code apply again', () => {
    const changed = setRule(DEFAULTS, 'amounts.message', 4);
    expect(saveBody(changed, DEFAULTS)).toEqual(changed);
    // "Reset to defaults" fills the form with the defaults
    expect(saveBody(structuredClone(DEFAULTS), DEFAULTS)).toBeNull();
  });

  it('the GeoGuess simulator shows the working, the cap and the edge, with the rules being typed', () => {
    const sim = { difficulty: 'hard' as const, km: 200, players: 4, closest: true, unsent: true, earnedToday: 0 };
    expect(simulateGeoguess(DEFAULTS, sim)).toEqual({ xp: 20, text: '15 pin × 0.75 closeness + 9 bonus = 20.25 → × 2 hard → × 0.5 unsent = 20 XP' });
    expect(simulateGeoguess(DEFAULTS, { ...sim, earnedToday: 490 })).toMatchObject({ xp: 10, text: expect.stringMatching(/= 20 XP, cut to 10 by the daily cap$/) });
    expect(simulateGeoguess(DEFAULTS, { ...sim, km: 600 })).toEqual({ xp: 0, text: 'Outside the 500 km radius: 0 XP' });
    // A radius typed but not saved yet already counts
    expect(simulateGeoguess(setRule(DEFAULTS, 'geoguess.radiusHard', 700), { ...sim, km: 600 }).xp).toBeGreaterThan(0);
    expect(simulateGeoguess(DEFAULTS, { ...sim, players: 1, unsent: false, km: 80 })).toEqual({ xp: 30, text: '15 pin × 1 closeness = 15 → × 2 hard = 30 XP' });
  });

  it('reads the milestone hours as a list', () => {
    expect(parseHours('10, 50,100 ,')).toEqual([10, 50, 100]);
    expect(parseHours('10, x')).toEqual([10, NaN]);
  });
});
