import { Prisma } from '@prisma/client';
import { activityCalendar } from '../api/routes/features/voice-stats/calendar-sql';
import { voiceHeatmapCells } from '../api/routes/features/voice-stats/heatmap-sql';
import { discordDirectory } from '../api/utils/discord-directory';
import type { Db } from '../db';
import { getMemberHabits, getMemberOnline, getMemberSummary, getVoiceNeighbours } from '../stats/queries';
import { periodWindows, StatsPeriod } from '../stats/windows';
import { cardImageUrl, fetchImage } from './avatars';
import { DEFAULT_SECTIONS, statsCard, StatsCardSection } from './stats.card';
import { CardTheme } from './themes';

/**
 * A member's stats card (/stats and the dashboard download); `viewerId` marks
 * the viewer's own row. Names, avatars and the channel come from the Discord
 * directory, so it also works in demo mode. Only the picked sections' queries run.
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
  // Statuses have no guild: only read them for someone who is in this server
  const withOnline = sections.includes('habits') && (await directory.isMember(guildId, memberId));
  const [summary, habits, online, neighbours, calendar, heatmap] = await Promise.all([
    getMemberSummary(db, guildId, memberId, period),
    sections.includes('habits') ? getMemberHabits(db, guildId, memberId, period) : undefined,
    withOnline ? getMemberOnline(db, memberId, period) : undefined,
    sections.includes('totals') ? getVoiceNeighbours(db, guildId, memberId, period) : [],
    sections.includes('calendar') ? activityCalendar(db, guildId, memberId, tz) : undefined,
    sections.includes('heatmap')
      ? db.$queryRaw<{ hour: number; day_of_week: number; total_minutes: number }[]>(
          voiceHeatmapCells(guildId, tz, periodWindows(period).current.from, Prisma.sql`AND member_id = ${memberId}`)
        )
      : undefined,
  ]);

  // One lookup and one avatar fetch per person, whoever they appear as
  const companionIds = summary.companions.slice(0, 3).map((c) => c.memberId);
  const ids = [...new Set([memberId, ...companionIds, ...neighbours.map((n) => n.memberId)])];
  const members = await directory.members(guildId, ids);
  const people = new Map(
    await Promise.all(
      ids.map(async (id) => {
        const info = members.get(id);
        const person = {
          name: info?.displayName ?? info?.username ?? 'Unknown member',
          avatar: await fetchImage(cardImageUrl(info?.avatar)),
        };
        return [id, person] as const;
      })
    )
  );
  const person = (id: string) => people.get(id) ?? { name: 'Unknown member', avatar: undefined };
  const member = person(memberId);

  return statsCard(
    {
      summary,
      period,
      memberName: member.name,
      avatar: member.avatar,
      serverName: directory.guild(guildId)?.name ?? 'Unknown server',
      companions: companionIds.map(person),
      ranking: neighbours.length
        ? {
            members: neighbours[0].members,
            rows: neighbours.map((n) => ({ ...person(n.memberId), voiceMs: n.voiceMs, rank: n.rank, subject: n.memberId === memberId })),
          }
        : undefined,
      online,
      self: memberId === viewerId,
      sections,
      habits,
      calendar,
      heatmap: heatmap?.map((row) => ({ day: row.day_of_week, hour: row.hour, minutes: row.total_minutes })),
    },
    theme
  );
};
