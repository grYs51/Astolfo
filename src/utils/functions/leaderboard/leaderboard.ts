import { voice_stats } from '@prisma/client';
import DiscordClient from '../../../client/client';
import {
  getCurrentVoiceStats,
} from './currentLeaderboard';
import { getActiveLeaderboard, getActiveVoiceStats } from './activeLeaderboard';

export type SimpleGuildMember = { id: string; user: { username: string } };

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
  inactive: 'InActive',
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

//TODO: fill in other getters
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
};

export const getLeaderboard = async (
  client: DiscordClient,
  guildId: string,
  type: LeaderboardTypes,
  timeRange: LeaderboardTimeRanges
) => {
  const { getVoiceStats, getLeaderboard } = getVoiceStatsAndLeaderboard[type];

  let startDate;
  //TODO: fill in correct startDate
  switch (timeRange) {
    case 'month':
      startDate = new Date();
      break;
    case 'week':
      startDate = new Date();
      break;
    case 'today':
      startDate = new Date();
      break;
  }

  const voiceStats = await getVoiceStats(client, guildId,startDate);

  if (!voiceStats.length) {
    return null;
  }

  const members = client.guilds.cache
    .get(guildId)!
    .members.cache.map((x) => x);

  const leaderboard =  getLeaderboard(members, voiceStats);

  return leaderboard;
};
