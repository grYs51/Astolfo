import { voice_stats } from '@prisma/client';
import { getActiveLeaderboard } from './activeLeaderboard';
import { SimpleGuildMember } from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';

const memberOne = { id: '1', user: { username: 'user 1' }, displayName: 'user 1' } as SimpleGuildMember;

const stat = (
  member_id: string,
  type: VOICE_TYPE,
  issued: string,
  ended: string
): voice_stats => ({
  id: '1',
  guild_id: '1',
  member_id,
  channel_id: '1',
  issued_on: new Date(issued),
  ended_on: new Date(ended),
  type,
});

describe('activeLeaderboard', () => {
  test('deducts muted time from voice time', () => {
    /*
    VOICE: |-----------| 10:00-12:00
    MUTED:    |-----|    10:30-11:30
    */
    const leaderboard = getActiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:30:00', '2024-12-25T11:30:00'),
      ]
    );

    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].count).toBe(1 * 60 * 60 * 1000);
  });

  test('simultaneous MUTED and DEAF intervals are not double-deducted', () => {
    /*
    VOICE: |-----------| 10:00-12:00
    MUTED:    |-----|    10:30-11:30
    DEAF:     |-----|    10:30-11:30 (deafening also mutes)
    */
    const leaderboard = getActiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:30:00', '2024-12-25T11:30:00'),
        stat('1', VOICE_TYPE.DEAF, '2024-12-25T10:30:00', '2024-12-25T11:30:00'),
      ]
    );

    expect(leaderboard.length).toBe(1);
    // 2h voice - 1h merged muted/deaf, NOT 2h - 2h = 0
    expect(leaderboard[0].count).toBe(1 * 60 * 60 * 1000);
  });

  test('partially overlapping deduction intervals are merged', () => {
    /*
    VOICE: |---------------| 10:00-14:00
    MUTED:   |-----|         10:30-11:30
    DEAF:       |------|     11:00-12:30
    merged deduction: 10:30-12:30 = 2h → active 2h
    */
    const leaderboard = getActiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T14:00:00'),
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:30:00', '2024-12-25T11:30:00'),
        stat('1', VOICE_TYPE.DEAF, '2024-12-25T11:00:00', '2024-12-25T12:30:00'),
      ]
    );

    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].count).toBe(2 * 60 * 60 * 1000);
  });

  test('deduction intervals are clipped to the voice span', () => {
    /*
    VOICE:    |------|   10:00-11:00
    MUTED: |------------|  09:00-12:00
    */
    const leaderboard = getActiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T11:00:00'),
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T09:00:00', '2024-12-25T12:00:00'),
      ]
    );

    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].count).toBe(0);
  });

  test("other members' muted stats are not deducted", () => {
    const memberTwo = { id: '2', user: { username: 'user 2' }, displayName: 'user 2' } as SimpleGuildMember;
    const leaderboard = getActiveLeaderboard(
      [memberOne, memberTwo],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('2', VOICE_TYPE.MUTED, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
      ]
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].id).toBe('1');
    expect(leaderboard[0].count).toBe(2 * 60 * 60 * 1000);
  });
});
