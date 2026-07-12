/**
 * Wire types for the voice-stats endpoints
 * (apps/bot/src/api/routes/features/voice-stats/*).
 *
 * Single source of truth imported by BOTH the Express handlers (which type
 * their responses with these) and the Angular data-access libs — changing a
 * response shape here breaks whichever side no longer matches, at build time.
 */

/**
 * Timestamps are `Date` on the server when the response is built and ISO
 * strings on the client after JSON serialization.
 */
export type DateLike = Date | string;

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

// Voice Activity Types — values match VOICE_TYPE stored in the DB (uppercase)
export enum VoiceActivityType {
  VOICE = 'VOICE',
  DEAF = 'DEAF',
  SERVER_DEAF = 'SERVER_DEAF',
  MUTED = 'MUTED',
  SERVER_MUTED = 'SERVER_MUTED',
  STREAMING = 'STREAMING',
  VIDEO = 'VIDEO',
}

export type VoiceStatsPeriod = 'day' | 'week' | 'month' | 'all';
export type TimelinePeriod = 'day' | 'week' | 'month' | 'year';
export type HeatmapPeriod = 'week' | 'month' | 'year' | 'all';

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
    /** Sessions with ended_on IS NULL — users currently in voice. */
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
  period: VoiceStatsPeriod;
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
  issuedOn: DateLike;
  /** null = session still open (user is currently in voice). */
  endedOn: DateLike | null;
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
  period: TimelinePeriod;
  granularity: 'hour' | 'day' | 'week';
  startDate: DateLike;
  endDate: DateLike;
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
  period: HeatmapPeriod;
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

// Paginated raw session list (GET /features/voice-stats/:serverId)
export interface VoiceStatsItem {
  id: string;
  guild_id: string;
  member_id: string;
  channel_id: string;
  type: VoiceActivityType;
  issued_on: DateLike;
  /** null = session still open. */
  ended_on: DateLike | null;
}

export interface VoiceStatsResponse {
  items: VoiceStatsItem[];
  total: number;
  limit: number;
  offset: number;
}
