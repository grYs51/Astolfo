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

/** Someone in voice right now (an open session) */
export interface LiveVoiceMember {
  member: DiscordMember;
  channel: DiscordChannel;
  since: DateLike;
}

/** GET/PUT /features/me/privacy */
export interface MemberPrivacy {
  /** Hidden from other members' views (leaderboards, companions, live list, profile) */
  hidden: boolean;
}

/** A channel with a message count */
export interface ChannelMessageCount {
  channel: DiscordChannel;
  count: number;
}

/** A member with a message count (text "leaderboard") */
export interface MemberMessageCount {
  member: DiscordMember;
  count: number;
  /** Distinct channels they wrote in */
  channels: number;
}

/** Text activity of a server for a period (GET …/:serverId/messages) */
export interface ServerMessageStats {
  period: DashboardPeriod;
  total: number;
  /** total of the period just before (same length); null for 'all' */
  previousTotal: number | null;
  activeMembers: number;
  /** Top 5 text channels */
  topChannels: ChannelMessageCount[];
  /** Most messages first (up to 100, so the viewer's rank is known) */
  topMembers: MemberMessageCount[];
}

/** A member the viewer shared voice channels with */
export interface VoiceCompanion {
  member: DiscordMember;
  /** Time spent in the same channel at the same time, in ms */
  togetherDuration: number;
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

export type VoiceStatsPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
export type TimelinePeriod = 'day' | 'week' | 'month' | 'year' | 'all';
/** The one period picker on the dashboard detail page */
export type DashboardPeriod = 'week' | 'month' | 'year' | 'all';
export type HeatmapPeriod = 'week' | 'month' | 'year' | 'all';
export type TimelineGranularity = 'hour' | 'day' | 'week';

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
  /** Server display data; name/icon are null if the bot can't see the guild */
  guild: { id: string; name: string | null; icon: string | null };

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
    /** totalDuration of the period just before (same length); null for 'all' */
    previousTotalDuration: number | null;
  };

  /** Everyone in voice right now, longest-running first (not limited to the period) */
  liveNow: LiveVoiceMember[];

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
    /** totalDuration of the period just before (same length); null for 'all' */
    previousTotalDuration: number | null;
  };

  /** Who the user shared voice channels with most in the period (top 5) */
  companions: VoiceCompanion[];

  /** Text activity in the period */
  messages: {
    count: number;
    /** count of the period just before; null for 'all' */
    previousCount: number | null;
    topChannels: ChannelMessageCount[];
  };

  // Recent activity
  recentSessions: VoiceSession[];
  channelBreakdown: VoiceChannelBreakdown[];
}

// Voice Stats Timeline Response
export interface VoiceStatsTimelineBucket {
  /** Bucket start as wall-clock time in the requested `tz` (default UTC): 'YYYY-MM-DDTHH:mm' for hourly, 'YYYY-MM-DD' otherwise */
  timestamp: string;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  uniqueUsers: number;
  uniqueChannels: number;
  averageSessionDuration: number;
  /** The requesting user's part of totalDuration */
  myDuration: number;
  /** Messages sent in this bucket, and the requesting user's part */
  messageCount: number;
  myMessageCount: number;

  // Activity breakdown for this time bucket
  activityBreakdown?: ActivityTypeBreakdown[];
}

export interface VoiceStatsTimeline {
  /** Every bucket from the period start to now, in order; quiet ones are zero */
  timeline: VoiceStatsTimelineBucket[];
  period: TimelinePeriod;
  granularity: TimelineGranularity;
  startDate: DateLike;
  endDate: DateLike;
}

// Voice Stats Heatmap Response
export interface VoiceStatsHeatmapDataPoint {
  hour: number; // 0-23, in the requested `tz` (default UTC)
  dayOfWeek: number; // 0-6 (Sunday-Saturday), in the requested `tz`
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
  hour: number; // 0-23, in the requested `tz` (default UTC)
  dayOfWeek: number; // 0-6 (Sunday-Saturday), in the requested `tz`
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
