import { voice_stats } from "@prisma/client";
import { getLeaderboard } from "./leaderboard";

describe('leaderboard', () => {
  test('should return a leaderboard with seconds', () => {
    const client = {
      guilds: {
        cache: {
          get: jest.fn().mockReturnValue({
            members: {
              cache: {
                get: jest.fn().mockReturnValue({
                  user: {
                    username: 'username',
                    member_id: 'member_id',
                  },
                }),
              },
            },
          }),
        },
      },
    };
    const stats: voice_stats[] = [
      {
        member_id: 'member_id',
        channel_id: 'channel_id',
        guild_id: 'guild_id',
        id: 'id',
        issued_by_id: 'issued_by_id',
        new_channel_id: 'new_channel_id',
        type: 'type',
        ended_on: new Date('2021-01-02'),
        issued_on: new Date('2021-01-01'),
      },
    ];
    const guildId = 'guildId';
    const result = getLeaderboard(client as any, stats, guildId);
    expect(result).toEqual([
      {
        id: 'member_id',
        count: 86400000,
        name: 'username',
      },
    ]);
  });


});