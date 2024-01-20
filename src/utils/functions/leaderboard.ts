import { guild_stats } from '@prisma/client';
import DiscordClient from '../../client/client';

export const getLeaderboard = (
  client: DiscordClient,
  stats: guild_stats[],
  guildId: string,
) =>
  stats.reduce((acc, stat) => {
    const a = acc.find((x) => x.id === stat.member_id);

    if (a) {
      a.count += stat.ended_on!.getTime() - stat.issued_on.getTime();
    } else {
      if (client.guilds.cache.get(guildId)!.members.cache.get(stat.member_id)) {
        acc.push({
          id: stat.member_id,
          count: stat.ended_on!.getTime() - stat.issued_on.getTime(),
          name:
            client.guilds.cache.get(guildId)!.members.cache.get(stat.member_id)
              ?.user.username || 'Unknown',
          // stat.member.guildName,
        });
      }
    }
    return acc;
  }, [] as Leaderboard[]);

export const getLeaderboardActive = (
  client: DiscordClient,
  guildId: string,
  inChannel: guild_stats[],
  leaderboard: Leaderboard[],
) =>
  inChannel.reduce((acc, stat) => {
    const a = acc.find((x) => x.id === stat.member_id);

    if (a) {
      a.count += new Date().getTime() - stat.issued_on.getTime();
    } else {
      acc.push({
        id: stat.member_id,
        count: new Date().getTime() - stat.issued_on.getTime(),
        name: client.guilds.cache
          .get(guildId)!
          .members.cache.get(stat.member_id)!.user.username,
        // stat.member.guildName,
      });
    }
    return acc;
  }, leaderboard);

interface Leaderboard {
  id: string;
  name: string;
  count: number;
}
