import { voice_stats } from '@prisma/client';
import DiscordClient from '../../../client/client';
import { getCurrentVoiceStats } from './currentLeaderboard';
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
} as const;

export type LeaderboardTypes = keyof typeof leaderboardTypesLabels;
export type LeaderboardTimeRanges = keyof typeof leaderboardTimeRangeLabels;
export type getVoiceStatsType = (
  client: DiscordClient,
  guildId,
  fromTime?: Date
) => Promise<voice_stats[]>;

export type getLeaderboardType = (
  members: SimpleGuildMember[],
  stats: voice_stats[]
) => Leaderboard[];

type GetLeaderBoardType = {
  getVoiceStats: getVoiceStatsType;
  getLeaderboard: getLeaderboardType;
};

const getVoiceStatsAndLeaderboard: Record<
  LeaderboardTypes,
  GetLeaderBoardType
> = {
  current: {
    getLeaderboard: getActiveLeaderboard,
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
  const { getVoiceStats, getLeaderboard } = getVoiceStatsAndLeaderboard[type];

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
  }

  const voiceStats = await getVoiceStats(client, guildId, startDate);

  if (!voiceStats.length) {
    return null;
  }

  const members = client.guilds.cache.get(guildId)!.members.cache.map((x) => x);
  const leaderboard = getLeaderboard(members, voiceStats);

  return leaderboard;
};
