import { discordDirectory } from '../api/utils/discord-directory';
import type { Db } from '../db';
import { getMemberSummary } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { cardImageUrl, fetchImage } from './avatars';
import { statsCard } from './stats.card';
import { CardTheme } from './themes';

/**
 * A member's stats card as `viewerId` may see it (/stats and the dashboard
 * download). Names, avatars and the channel come from the Discord directory,
 * so it also works in demo mode. The caller checks the member doesn't hide
 * from the viewer.
 */
export const statsCardSvg = async (opts: {
  db: Pick<Db, '$queryRaw'>;
  guildId: string;
  memberId: string;
  viewerId: string;
  period: StatsPeriod;
  theme: CardTheme;
}) => {
  const { db, guildId, memberId, viewerId, period, theme } = opts;
  const directory = discordDirectory();
  const summary = await getMemberSummary(db, guildId, memberId, period, viewerId);

  const companionIds = summary.companions.slice(0, 3).map((c) => c.memberId);
  const members = await directory.members(guildId, [memberId, ...companionIds]);
  const [member, ...companions] = await Promise.all(
    [memberId, ...companionIds].map(async (id) => {
      const info = members.get(id);
      return {
        name: info?.displayName ?? info?.username ?? 'Unknown member',
        avatar: await fetchImage(cardImageUrl(info?.avatar)),
      };
    })
  );

  return statsCard(
    {
      summary,
      period,
      memberName: member.name,
      avatar: member.avatar,
      serverName: directory.guild(guildId)?.name ?? 'Unknown server',
      favouriteChannelName: summary.favouriteChannelId
        ? directory.channel(guildId, summary.favouriteChannelId)?.name
        : undefined,
      companions,
      self: memberId === viewerId,
    },
    theme
  );
};
