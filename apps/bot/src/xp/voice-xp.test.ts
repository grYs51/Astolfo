import { DEFAULT_RULES } from './rules';
import { OtherPiece, Session, starterSessions, stayStarts, togetherMs, voiceXp } from './voice-xp';

const M = 60_000;
const T0 = Date.UTC(2026, 10, 10, 18, 0);
const at = (min: number) => T0 + min * M;
const session = (from: number, to: number, id = 's', channelId = 'vc'): Session => ({ id, channelId, from: at(from), to: at(to) });
const other = (memberId: string, from: number, to: number, sessionId = `${memberId}-1`): OtherPiece => ({
  memberId,
  sessionId,
  from: at(from),
  to: at(to),
});
const input = (s: Session, extra: Partial<Parameters<typeof voiceXp>[0]> = {}) => ({
  session: s,
  ownDeaf: [],
  ownVideo: [],
  ownStreaming: [],
  stayStart: s.from,
  others: [],
  channelName: 'general',
  ...extra,
});

describe('voiceXp', () => {
  test("the user's sketch: each stretch earns its own rate", () => {
    // alone 0–5, Alex joins at 5, Sam at 10, deafened 15–20, undeafened until 25
    const result = voiceXp(
      input(session(0, 25), {
        others: [other('alex', 5, 25), other('sam', 10, 25)],
        ownDeaf: [{ from: at(15), to: at(20) }],
      }),
      DEFAULT_RULES
    );
    expect(result.segments.map((s) => [s.multiplier, s.memberIds, s.deaf])).toEqual([
      [0.5, [], false],
      [1, ['alex'], false],
      [1.12, ['alex', 'sam'], false],
      [0.28, ['alex', 'sam'], true],
      [1.12, ['alex', 'sam'], false],
    ]);
    // 2.5 + 5 + 5.6 + 1.4 + 5.6 = 20.1
    expect(result.amount).toBe(20);
    expect(result.note).toBe('25 min in #general: 5 min alone, 5 min with 1 other, 10 min with 2 others, 5 min deafened');
  });

  test('alone for an hour is 31 XP', () => {
    expect(voiceXp(input(session(0, 60)), DEFAULT_RULES).amount).toBe(31);
  });

  test('alone and deafened for an hour is 7 XP', () => {
    expect(voiceXp(input(session(0, 60), { ownDeaf: [{ from: at(0), to: at(60) }] }), DEFAULT_RULES).amount).toBe(7);
  });

  test('the worked example: an hour with two friends is 70 XP', () => {
    const result = voiceXp(input(session(0, 60), { others: [other('a', 0, 60), other('b', 0, 60)] }), DEFAULT_RULES);
    expect(result.amount).toBe(70);
    expect(result.note).toBe('60 min in #general: 60 min with 2 others · up to 1.1× for staying');
  });

  test('camera on adds 10%', () => {
    const plain = voiceXp(input(session(0, 30), { others: [other('a', 0, 30)] }), DEFAULT_RULES);
    const camera = voiceXp(input(session(0, 30), { others: [other('a', 0, 30)], ownVideo: [{ from: at(0), to: at(30) }] }), DEFAULT_RULES);
    expect(plain.amount).toBe(30);
    expect(camera.amount).toBe(33);
  });

  test('screen share alone adds nothing', () => {
    const result = voiceXp(input(session(0, 30), { ownStreaming: [{ from: at(0), to: at(30) }] }), DEFAULT_RULES);
    expect(result.amount).toBe(15);
  });

  test('a channel move keeps the stay going, a 2 min gap resets it', () => {
    const first = session(0, 40, 'a', 'vc1');
    const moved = session(40, 70, 'b', 'vc2');
    const later = session(72, 100, 'c', 'vc2');
    const starts = stayStarts([later, moved, first]);
    expect(starts.get('b')).toBe(at(0));
    expect(starts.get('c')).toBe(at(72));
    // alone after 40 min in voice: 20 min at 0.55×, then 10 min at 0.6×
    expect(voiceXp(input(moved, { stayStart: starts.get('b') }), DEFAULT_RULES).amount).toBe(17);
  });

  test('a custom crowd cap changes the result', () => {
    const rules = { ...DEFAULT_RULES, voice: { ...DEFAULT_RULES.voice, crowdCap: 2 } };
    const crowd = 'abcdefghij'.split('').map((id) => other(id, 0, 30));
    expect(voiceXp(input(session(0, 30), { others: crowd }), DEFAULT_RULES).amount).toBe(45);
    // 1 + 0.12 × 9 = 2.08, capped at 2
    expect(voiceXp(input(session(0, 30), { others: crowd }), rules).amount).toBe(60);
  });
});

describe('starterSessions', () => {
  const channel = (pieces: OtherPiece[]) => new Map([['vc', pieces]]);

  test('needs 10 min together', () => {
    expect(starterSessions([session(0, 30)], channel([other('a', 5, 14)]), DEFAULT_RULES)).toEqual([]);
    expect(starterSessions([session(0, 30)], channel([other('a', 5, 15)]), DEFAULT_RULES)).toHaveLength(1);
  });

  test('joining someone already there is not starting', () => {
    expect(starterSessions([session(5, 30)], channel([other('a', 0, 30)]), DEFAULT_RULES)).toEqual([]);
  });

  test('the fourth in a day earns nothing', () => {
    const sessions = [0, 60, 120, 180].map((m, i) => session(m, m + 30, `s${i}`));
    const pieces = [0, 60, 120, 180].map((m, i) => other('a', m + 5, m + 30, `a${i}`));
    const result = starterSessions(sessions, channel(pieces), DEFAULT_RULES);
    expect(result.map((r) => [r.session.id, r.n])).toEqual([
      ['s0', 1],
      ['s1', 2],
      ['s2', 3],
    ]);
    // Two already granted that day: only one more
    expect(starterSessions(sessions, channel(pieces), DEFAULT_RULES, new Map([['2026-11-10', 2]]))).toHaveLength(1);
  });
});

test('togetherMs sums the overlap', () => {
  expect(togetherMs(session(0, 30), [other('a', -10, 10), other('a', 20, 40)])).toBe(20 * M);
});
