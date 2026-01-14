// Discord Data Types
export interface DiscordMember {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: string;
}

// Voice Activity Types
export enum VoiceActivityType {
  VOICE = 'voice',
  DEAFENED = 'deafened',
  MUTED = 'muted',
  STREAMING = 'streaming',
  VIDEO = 'video',
  SCREENSHARE = 'screenshare'
}

// Activity Type Breakdown
export interface ActivityTypeBreakdown {
  type: VoiceActivityType;
  duration: number;
  durationHours: number;
  durationMinutes: number;
  sessionCount: number;
  percentage: number;
}

// Voice Stats Overview Response
export interface VoiceStatsOverview {
  // Server-wide statistics
  server: {
    totalDuration: number;
    totalDurationHours: number;
    totalDurationMinutes: number;
    totalSessions: number;
    activeUsers: number;
    activeSessions: number;
    mostActiveChannel: DiscordChannel | null;
    mostActiveChannelDuration: number;
    mostActiveChannelSessions: number;
  };

  // Activity type breakdown
  activityBreakdown: ActivityTypeBreakdown[];
}

// Voice Stats Leaderboard Response
export interface VoiceStatsLeaderboardEntry {
  member: DiscordMember;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  uniqueChannels: number;
  averageSessionDuration: number;
}

export interface VoiceStatsLeaderboard {
  leaderboard: VoiceStatsLeaderboardEntry[];
  period: 'day' | 'week' | 'month' | 'all';
  total: number;
}

// Voice Stats Channels Response
export interface VoiceStatsChannel {
  channel: DiscordChannel;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  averageSessionDurationMinutes: number;
}

export interface VoiceStatsChannels {
  channels: VoiceStatsChannel[];
  total: number;
}

// Voice Stats User Response
export interface VoiceSession {
  id: string;
  channel: DiscordChannel;
  issuedOn: Date;
  endedOn: Date;
  duration: number;
  durationMinutes: number;
  type: VoiceActivityType;
}

export interface VoiceChannelBreakdown {
  channel: DiscordChannel;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  percentage: number;
}

export interface VoiceStatsUser {
  userId: string;
  member: DiscordMember;

  // Overall statistics
  summary: {
    totalDuration: number;
    totalDurationHours: number;
    totalDurationMinutes: number;
    sessionCount: number;
    uniqueChannels: number;
    favoriteChannel: DiscordChannel | null;
    favoriteChannelDuration: number;
    averageSessionDuration: number;
    averageSessionDurationMinutes: number;
  };

  // Activity type breakdown
  activityBreakdown: ActivityTypeBreakdown[];

  // Recent activity
  recentSessions: VoiceSession[];
  channelBreakdown: VoiceChannelBreakdown[];
}

// Voice Stats Timeline Response
export interface VoiceStatsTimelineBucket {
  timestamp: string;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  uniqueUsers: number;
  uniqueChannels: number;
  averageSessionDuration: number;

  // Activity breakdown for this time bucket
  activityBreakdown?: ActivityTypeBreakdown[];
}

export interface VoiceStatsTimeline {
  timeline: VoiceStatsTimelineBucket[];
  period: 'day' | 'week' | 'month' | 'year';
  granularity: 'hour' | 'day' | 'week';
  startDate: Date;
  endDate: Date;
}

// Voice Stats Heatmap Response
export interface VoiceStatsHeatmapDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  value: number; // total minutes
  sessionCount: number;
  uniqueUsers: number;

  // Activity type breakdown for this cell
  activityBreakdown?: ActivityTypeBreakdown[];
}

export interface VoiceStatsHeatmap {
  heatmap: VoiceStatsHeatmapDataPoint[];
  stats: {
    totalMinutes: number;
    maxValue: number;
    avgValue: number;
    peakHour: number;
    peakDay: number;
    totalCells: number;
  };
}

// Voice Stats User Heatmap (Comparison with Server)
export interface VoiceStatsUserHeatmapDataPoint {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  userValue: number; // user's total minutes
  serverAverage: number; // server average minutes for this time slot
  difference: number; // user value - server average
  percentageOfServer: number; // user's percentage of total server activity
  sessionCount: number; // user's session count
}

export interface VoiceStatsUserHeatmap {
  userId: string;
  period: 'week' | 'month' | 'year' | 'all';
  userHeatmap: VoiceStatsUserHeatmapDataPoint[];
  stats: {
    user: {
      totalMinutes: number;
      maxValue: number;
      avgValue: number;
      peakHour: number;
      peakDay: number;
      totalCells: number;
    };
    server: {
      totalMinutes: number;
      avgPerUser: number;
      totalUsers: number;
    };
    comparison: {
      userVsServerAvg: number; // percentage (100 = equal to average, >100 = above average)
      aboveAverage: boolean;
    };
  };
}

// Original response (for backward compatibility)
export interface VoiceStatsResponse {
  items: unknown[];
  total: number;
  limit: number;
  offset: number;
}
