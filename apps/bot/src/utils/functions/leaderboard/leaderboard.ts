import { ClosedVoiceStat } from './intervals';
import DiscordClient from '../../../client/client';
import { getCurrentLeaderboard, getCurrentVoiceStats } from './currentLeaderboard';
import { getActiveLeaderboard, getActiveVoiceStats } from './activeLeaderboard';
import { getLonerLeaderboard, getLonerVoiceStats } from './lonerLeaderboard';
import {
  getInactiveLeaderboard,
  getInactiveVoiceStats,
} from './inactiveLeaderboard';

export type SimpleGuildMember = {
  id: string;
  user: { username: string };
  displayName: string | null;
};

export interface Leaderboard {
  id: string;
  name: string;
  count: number;
}

export const leaderboardTimeRangeLabels = {
  allTime: 'All Time',
  month: 'Last 31 days',
  week: 'Last 7 days',
  today: 'Today',
  // year: "This Year"
} as const;

export const leaderboardTypesLabels = {
  active: 'Active',
  current: 'Current',
  loner: 'Loner',
  inactive: 'Inactive',
  xp: 'XP',
} as const;

export type LeaderboardTypes = keyof typeof leaderboardTypesLabels;
export type LeaderboardTimeRanges = keyof typeof leaderboardTimeRangeLabels;
export type getVoiceStatsType = (
  client: DiscordClient,
  guildId: string,
  fromTime?: Date
) => Promise<ClosedVoiceStat[]>;

export type getLeaderboardType = (
  members: SimpleGuildMember[],
  stats: ClosedVoiceStat[]
) => Leaderboard[];

type GetLeaderBoardType = {
  getVoiceStats: getVoiceStatsType;
  getLeaderboard: getLeaderboardType;
};

const getVoiceStatsAndLeaderboard: Record<
  Exclude<LeaderboardTypes, 'xp'>,
  GetLeaderBoardType
> = {
  current: {
    getLeaderboard: getCurrentLeaderboard,
    getVoiceStats: getCurrentVoiceStats,
  },
  active: {
    getLeaderboard: getActiveLeaderboard,
    getVoiceStats: getActiveVoiceStats,
  },
  loner: {
    getLeaderboard: getLonerLeaderboard,
    getVoiceStats: getLonerVoiceStats,
  },
  inactive: {
    getLeaderboard: getInactiveLeaderboard,
    getVoiceStats: getInactiveVoiceStats,
  },
};

export const getLeaderboard = async (
  client: DiscordClient,
  guildId: string,
  type: LeaderboardTypes,
  timeRange: LeaderboardTimeRanges
) => {
  let startDate: Date | undefined;

  switch (timeRange) {
    case 'allTime':
      startDate = undefined;
      break;
    case 'month':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 31);
      break;
    case 'week':
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'today':
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      startDate = undefined;
  }

  const members =
    client.guilds.cache.get(guildId)?.members.cache.map((x) => x) ?? [];

  if (type === 'xp') {
    return getXpLeaderboard(client, guildId, members, startDate);
  }

  const { getVoiceStats, getLeaderboard } = getVoiceStatsAndLeaderboard[type];
  const voiceStats = await getVoiceStats(client, guildId, startDate);

  if (!voiceStats.length) {
    return null;
  }

  return getLeaderboard(members, voiceStats);
};

/** XP earned in the range (all time by default); `count` is XP, not ms */
const getXpLeaderboard = async (
  client: DiscordClient,
  guildId: string,
  members: SimpleGuildMember[],
  from?: Date
): Promise<Leaderboard[] | null> => {
  const sums = await client.dataSource.xpEvents.groupBy({
    by: ['member_id'],
    where: { guild_id: guildId, created_at: from ? { gte: from } : undefined },
    _sum: { amount: true },
  });
  const membersById = new Map(members.map((member) => [member.id, member]));
  const rows = sums.flatMap(({ member_id, _sum }) => {
    const member = membersById.get(member_id);
    // Members no longer in the guild (or not cached) are skipped, like the voice boards
    return member && _sum.amount ? [{ id: member_id, name: member.displayName ?? member.user.username, count: _sum.amount }] : [];
  });
  return rows.length ? rows : null;
};
