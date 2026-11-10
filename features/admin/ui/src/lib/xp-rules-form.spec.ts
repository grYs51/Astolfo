import type { XpRules } from '@nx-stolfo/data-access-admin';
import { getRule, levelsPreview, parseHours, saveBody, setRule, XP_RULE_GROUPS } from './xp-rules-form';

const DEFAULTS: XpRules = {
  levelStep: 50,
  levelBase: 100,
  voice: { alone: 0.5, oneOther: 1, perExtra: 0.12, crowdCap: 1.5, deafened: 0.25, stayStep: 0.1, stayEveryMin: 30, stayCap: 1.5, camera: 0.1, screenShare: 0.1 },
  amounts: { voiceMinute: 1, starter: 15, message: 2, streakDay: 10, gameWin: 5, gameStreakStep: 2, gameStreakCap: 10, reconnect: 25, welcome: 20, milestone: 100, weekly: [50, 30, 20] },
  thresholds: { togetherMin: 10, reconnectDays: 30, welcomeAfterDays: 30, startersPerDay: 3, milestoneHours: [10, 50, 100, 250, 500, 1000] },
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

  it('reads the milestone hours as a list', () => {
    expect(parseHours('10, 50,100 ,')).toEqual([10, 50, 100]);
    expect(parseHours('10, x')).toEqual([10, NaN]);
  });
});
