import { Prisma } from '@prisma/client';
import { activityCalendar } from '../api/routes/features/voice-stats/calendar-sql';
import { voiceHeatmapCells } from '../api/routes/features/voice-stats/heatmap-sql';
import { discordDirectory } from '../api/utils/discord-directory';
import type { Db } from '../db';
import { getMemberHabits, getMemberSummary } from '../stats/queries';
import { periodWindows, StatsPeriod } from '../stats/windows';
import { cardImageUrl, fetchImage } from './avatars';
import { DEFAULT_SECTIONS, statsCard, StatsCardSection } from './stats.card';
import { CardTheme } from './themes';

/**
 * A member's stats card as `viewerId` may see it (/stats and the dashboard
 * download). Names, avatars and the channel come from the Discord directory,
 * so it also works in demo mode. Only the picked sections' queries run.
 * The caller checks the member doesn't hide from the viewer.
 */
export const statsCardSvg = async (opts: {
  db: Pick<Db, '$queryRaw'>;
  guildId: string;
  memberId: string;
  viewerId: string;
  period: StatsPeriod;
  theme: CardTheme;
  sections?: readonly StatsCardSection[];
  /** The viewer's time zone, for the calendar and heatmap days */
  tz?: string;
}) => {
  const { db, guildId, memberId, viewerId, period, theme, sections = DEFAULT_SECTIONS, tz = 'UTC' } = opts;
  const directory = discordDirectory();
  const [summary, habits, calendar, heatmap] = await Promise.all([
    getMemberSummary(db, guildId, memberId, period, viewerId),
    sections.includes('habits') ? getMemberHabits(db, guildId, memberId, period) : undefined,
    sections.includes('calendar') ? activityCalendar(db, guildId, memberId, tz) : undefined,
    sections.includes('heatmap')
      ? db.$queryRaw<{ hour: number; day_of_week: number; total_minutes: number }[]>(
          voiceHeatmapCells(guildId, tz, periodWindows(period).current.from, Prisma.sql`AND member_id = ${memberId}`)
        )
      : undefined,
  ]);

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
      sections,
      habits,
      calendar,
      heatmap: heatmap?.map((row) => ({ day: row.day_of_week, hour: row.hour, minutes: row.total_minutes })),
    },
    theme
  );
};
