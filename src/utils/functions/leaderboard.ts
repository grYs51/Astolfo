import DiscordClient from '../../client/client';
import { GuildStats } from '../../db/models';

export const getLeaderboard = (
  client: DiscordClient,
  stats: GuildStats[],
  guildId: string,
) =>
  stats.reduce((acc, stat) => {
    const a = acc.find((x) => x.id === stat.memberId);

    if (a) {
      a.count += stat.endedOn!.getTime() - stat.issuedOn.getTime();
    } else {
      if (client.guilds.cache.get(guildId)!.members.cache.get(stat.memberId)) {
        acc.push({
          id: stat.memberId,
          count: stat.endedOn!.getTime() - stat.issuedOn.getTime(),
          name:
            client.guilds.cache.get(guildId)!.members.cache.get(stat.memberId)
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
  inChannel: GuildStats[],
  leaderboard: Leaderboard[],
) =>
  inChannel.reduce((acc, stat) => {
    const a = acc.find((x) => x.id === stat.memberId);

    if (a) {
      a.count += new Date().getTime() - stat.issuedOn.getTime();
    } else {
      acc.push({
        id: stat.memberId,
        count: new Date().getTime() - stat.issuedOn.getTime(),
        name: client.guilds.cache
          .get(guildId)!
          .members.cache.get(stat.memberId)!.user.username,
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
