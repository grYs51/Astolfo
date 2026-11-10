import type { XpLevel } from './xp.dto';

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
export type TimelineGranularity = 'day' | 'week';

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

/**
 * A member's voice time by state, in ms, each capped to voice. muted and
 * deafened include server mute/deafen; muted includes self-deafened time.
 */
export interface VoiceHabits {
  voice: number;
  muted: number;
  deafened: number;
  video: number;
  streaming: number;
}

/** What the voice-habits leaderboard ranks by: video or streaming time */
export type VoiceHabitMetric = 'camera' | 'streaming';

/** GET …/:serverId/voice-habits: top first (up to 100, so the viewer's rank is known) */
export interface VoiceHabitsLeaderboard {
  period: DashboardPeriod;
  metric: VoiceHabitMetric;
  leaderboard: { member: DiscordMember; habits: VoiceHabits }[];
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
  /** Display data for the profile header */
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
    /** totalDuration of the period just before (same length); null for 'all' */
    previousTotalDuration: number | null;
  };

  /** Voice time by state in the period (camera, streaming, deafened, muted) */
  habits: VoiceHabits;

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

  /** Voice days (UTC days with 10+ min in voice) in a row; all time, not per period */
  streak: { current: number; longest: number };
  /** All-time voice ms */
  lifetimeMs: number;
  /** Next lifetime voice-hours milestone; null once every milestone is reached */
  nextMilestone: { hours: number; remainingMs: number } | null;
  /** Level and XP on the server; all time */
  level: XpLevel;
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
  sessionCount: number; // sessions in voice during this hour (one session spans several cells)
  uniqueUsers: number; // members in voice during this hour

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
  sessionCount: number; // user's sessions in voice during this hour (one session spans several cells)
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

// Activity calendar ("GitHub-style" graph): the last 12 months, one entry per day
export interface ActivityCalendarDay {
  /** Day in the requested `tz` (default UTC), 'YYYY-MM-DD' */
  date: string;
  /** Voice minutes (VOICE rows, bucketed by the day the session started) */
  minutes: number;
  messages: number;
}

export interface ActivityCalendar {
  /** Only days with activity, oldest first */
  days: ActivityCalendarDay[];
  /** First day of the range, 'YYYY-MM-DD' in `tz` */
  start: string;
  /** Today, 'YYYY-MM-DD' in `tz` */
  end: string;
}

/** Parts of the stats card download (`…/users/:userId/stats.png?sections=`), in the order the card draws them */
export type StatsCardSection = 'totals' | 'streak' | 'habits' | 'calendar' | 'heatmap' | 'companions';

/** Colours of the image cards (`?theme=`) */
export type StatsCardTheme = 'stolfo' | 'dark' | 'light';
