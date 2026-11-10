import { ClosedVoiceStat } from './intervals';
import { getLonerLeaderboard } from './lonerLeaderboard';
import { SimpleGuildMember } from './leaderboard';

const memberOne = { id: '1', user: { username: 'user 1' } } as SimpleGuildMember;
const memberTwo = { id: '2', user: { username: 'user 2' } } as SimpleGuildMember;
const memberThree = { id: '3', user: { username: 'user 3' } } as SimpleGuildMember;

describe('lonerboard', () => {
  test('full overlap', () => {
    /*
    1:  |-----------|
    2:   |-----|
    */

    const voice_stats: ClosedVoiceStat[] = [
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T10:00:00'),
        ended_on: new Date('2024-12-25T12:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '2',
        channel_id: '1',
        issued_on: new Date('2024-12-25T10:30:00'),
        ended_on: new Date('2024-12-25T11:30:00'),
        type: '1',
      },
    ];
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo],
      voice_stats
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.length).toBe(1);
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[0].id).toBe('1');
  });
  test('half overlap', () => {
    /*
    1:    |-----------|
    2: |-----|
    */

    const voice_stats: ClosedVoiceStat[] = [
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T09:00:00'),
        ended_on: new Date('2024-12-25T10:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '2',
        channel_id: '1',
        issued_on: new Date('2024-12-25T09:30:00'),
        ended_on: new Date('2024-12-25T11:00:00'),
        type: '1',
      },
    ];
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo],
      voice_stats
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.length).toBe(2);
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(0.5 * 60 * 60 * 1000);
    expect(lonerboard[0].id).toBe('1');
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[1].id).toBe('2');
  });
  test('complex overlap', () => {
    /*
    1:      |-----------|
    2:   |-----|        |------|
    3: |----|  |-----|  |----| 
    */

    const voice_stats: ClosedVoiceStat[] = [
      {
        id: '1',
        guild_id: '1',
        member_id: '3',
        channel_id: '1',
        issued_on: new Date('2024-12-25T09:00:00'),
        ended_on: new Date('2024-12-25T11:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '2',
        channel_id: '1',
        issued_on: new Date('2024-12-25T10:00:00'),
        ended_on: new Date('2024-12-25T12:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T11:00:00'),
        ended_on: new Date('2024-12-25T16:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '3',
        channel_id: '1',
        issued_on: new Date('2024-12-25T12:00:00'),
        ended_on: new Date('2024-12-25T15:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '3',
        channel_id: '1',
        issued_on: new Date('2024-12-25T16:00:00'),
        ended_on: new Date('2024-12-25T17:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '2',
        channel_id: '1',
        issued_on: new Date('2024-12-25T16:00:00'),
        ended_on: new Date('2024-12-25T18:00:00'),
        type: '1',
      },
    ];
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo, memberThree],
      voice_stats
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.length).toBe(3);
    expect(lonerboard[0].id).toBe('1');
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[1].id).toBe('2');
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[2].id).toBe('3');
    expect(lonerboard[2].count).toBe(1 * 60 * 60 * 1000);
  });
  test('no overlap', () => {
    /*
    1:      |---|
    2: |--|
    */

    const voice_stats: ClosedVoiceStat[] = [
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T08:00:00'),
        ended_on: new Date('2024-12-25T09:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '2',
        channel_id: '1',
        issued_on: new Date('2024-12-25T10:00:00'),
        ended_on: new Date('2024-12-25T11:00:00'),
        type: '1',
      },
    ];
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo],
      voice_stats
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.length).toBe(2);
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[0].id).toBe('1');
    expect(lonerboard[1].count).toBe(1 * 60 * 60 * 1000);
    expect(lonerboard[1].id).toBe('2');
  });
  test('no overlap - same member', () => {
    /*
    1:   |--|  |---|
    */

    const voice_stats: ClosedVoiceStat[] = [
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T08:00:00'),
        ended_on: new Date('2024-12-25T09:00:00'),
        type: '1',
      },
      {
        id: '1',
        guild_id: '1',
        member_id: '1',
        channel_id: '1',
        issued_on: new Date('2024-12-25T10:00:00'),
        ended_on: new Date('2024-12-25T11:00:00'),
        type: '1',
      },
    ];
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo],
      voice_stats
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.length).toBe(1);
    //convert hours to milliseconds
    expect(lonerboard[0].count).toBe(2 * 60 * 60 * 1000);
    expect(lonerboard[0].id).toBe('1');
  });
  test('other channels do not count as company; own overlapping rows count once', () => {
    /*
    ch1  1:  |-----------|        (two overlapping rows of member 1)
    ch1  1:     |-----|
    ch2  2:  |-----------|
    */
    const row = (member_id: string, channel_id: string, from: string, to: string): ClosedVoiceStat => ({
      id: `${member_id}-${from}`,
      guild_id: '1',
      member_id,
      channel_id,
      issued_on: new Date(`2024-12-25T${from}:00`),
      ended_on: new Date(`2024-12-25T${to}:00`),
      type: '1',
    });
    const lonerboard = getLonerLeaderboard(
      [memberOne, memberTwo, memberThree],
      [
        row('1', '1', '10:00', '12:00'),
        row('1', '1', '10:30', '11:30'),
        row('2', '2', '10:00', '12:00'),
      ]
    ).toSorted((a, b) => Number(a.id) - Number(b.id));

    expect(lonerboard.map(({ id, count }) => [id, count])).toEqual([
      ['1', 2 * 60 * 60 * 1000],
      ['2', 2 * 60 * 60 * 1000],
    ]);
  });
});

describe('xp leaderboard', () => {
  test('sums XP per member still in the server', async () => {
    const { getLeaderboard } = await import('./leaderboard');
    const groupBy = jest.fn(async () => [
      { member_id: '1', _sum: { amount: 120 } },
      { member_id: 'gone', _sum: { amount: 999 } },
    ]);
    const client = {
      dataSource: { xpEvents: { groupBy } },
      guilds: { cache: new Map([['g', { members: { cache: { map: (f: (m: unknown) => unknown) => [memberOne].map(f) } } }]]) },
    } as never;
    expect(await getLeaderboard(client, 'g', 'xp', 'allTime')).toEqual([{ id: '1', name: 'user 1', count: 120 }]);
    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { guild_id: 'g', created_at: undefined } }));
  });
});
