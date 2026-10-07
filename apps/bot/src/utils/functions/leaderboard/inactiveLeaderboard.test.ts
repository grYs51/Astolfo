import { voice_stats } from '@prisma/client';
import { getInactiveLeaderboard } from './inactiveLeaderboard';
import { getLonerLeaderboard } from './lonerLeaderboard';
import { getOpenVoiceStats, unionDuration } from './intervals';
import { SimpleGuildMember } from './leaderboard';
import { VOICE_TYPE } from '../../handlers/vc';
import DiscordClient from '../../../client/client';

const HOUR = 60 * 60 * 1000;

const memberOne = { id: '1', user: { username: 'user 1' }, displayName: 'user 1' } as SimpleGuildMember;
const memberTwo = { id: '2', user: { username: 'user 2' }, displayName: 'user 2' } as SimpleGuildMember;

const stat = (
  member_id: string,
  type: VOICE_TYPE,
  issued: string,
  ended: string | null,
  channel_id = '1'
): voice_stats => ({
  id: `${member_id}-${type}-${issued}`,
  guild_id: '1',
  member_id,
  channel_id,
  issued_on: new Date(issued),
  ended_on: ended ? new Date(ended) : null,
  type,
});

describe('inactiveLeaderboard', () => {
  test('deafened (DEAF + MUTED) time counts once', () => {
    /*
    DEAF:  |-----------| 10:00-12:00
    MUTED: |-----------| 10:00-12:00 (deafening also mutes)
    */
    const leaderboard = getInactiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.DEAF, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
      ]
    );

    expect(leaderboard).toEqual([{ id: '1', name: 'user 1', count: 2 * HOUR }]);
  });

  test("other members' muted time in the same channel is not deducted", () => {
    const leaderboard = getInactiveLeaderboard(
      [memberOne, memberTwo],
      [
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('2', VOICE_TYPE.MUTED, '2024-12-25T11:00:00', '2024-12-25T12:00:00'),
      ]
    );

    expect(leaderboard.find((entry) => entry.id === '1')?.count).toBe(2 * HOUR);
    expect(leaderboard.find((entry) => entry.id === '2')?.count).toBe(1 * HOUR);
  });

  test('members no longer in the guild are skipped instead of throwing', () => {
    const leaderboard = getInactiveLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:00:00', '2024-12-25T11:00:00'),
        stat('gone', VOICE_TYPE.MUTED, '2024-12-25T10:00:00', '2024-12-25T11:00:00'),
      ]
    );

    expect(leaderboard.map((entry) => entry.id)).toEqual(['1']);
  });
});

describe('lonerLeaderboard', () => {
  test('members no longer in the guild are skipped instead of throwing', () => {
    const leaderboard = getLonerLeaderboard(
      [memberOne],
      [
        stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', '2024-12-25T12:00:00'),
        stat('gone', VOICE_TYPE.VOICE, '2024-12-25T11:00:00', '2024-12-25T12:00:00'),
      ]
    );

    // The departed member still overlaps, so member one was alone for 1h
    expect(leaderboard).toEqual([{ id: '1', name: 'user 1', count: 1 * HOUR }]);
  });
});

describe('unionDuration', () => {
  test('counts overlapping parts once and ignores empty intervals', () => {
    expect(
      unionDuration([
        { start: 0, end: 10 },
        { start: 5, end: 15 },
        { start: 20, end: 25 },
        { start: 30, end: 30 },
      ])
    ).toBe(20);
  });
});

describe('getOpenVoiceStats', () => {
  const clientWith = (stats: voice_stats[]) =>
    ({
      voiceUsers: new Map([
        ['1:1', stats],
        ['other-guild:1', [stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', null)]],
      ]),
    }) as unknown as DiscordClient;

  test('returns the guild rows of the requested types, closed at now', () => {
    const client = clientWith([
      stat('1', VOICE_TYPE.VOICE, '2024-12-25T10:00:00', null),
      stat('1', VOICE_TYPE.MUTED, '2024-12-25T10:30:00', null),
    ]);

    const open = getOpenVoiceStats(client, '1', [VOICE_TYPE.MUTED]);

    expect(open).toHaveLength(1);
    expect(open[0].type).toBe(VOICE_TYPE.MUTED);
    expect(open[0].ended_on).toBeInstanceOf(Date);
  });

  test('clips sessions that started before the time range', () => {
    const client = clientWith([stat('1', VOICE_TYPE.VOICE, '2024-12-20T10:00:00', null)]);
    const fromTime = new Date('2024-12-25T00:00:00');

    const [open] = getOpenVoiceStats(client, '1', [VOICE_TYPE.VOICE], fromTime);

    expect(open.issued_on).toEqual(fromTime);
  });
});
