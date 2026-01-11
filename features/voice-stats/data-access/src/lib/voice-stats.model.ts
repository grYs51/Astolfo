// Voice Stats Overview Response
export interface VoiceStatsOverview {
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  activeUsers: number;
  totalSessions: number;
  mostActiveChannel: string | null;
  mostActiveChannelDuration: number;
  mostActiveChannelSessions: number;
  activeSessions: number;
}

// Voice Stats Leaderboard Response
export interface VoiceStatsLeaderboardEntry {
  memberId: string;
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
  channelId: string;
  channelType: string;
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
  channelId: string;
  channelType: string;
  issuedOn: Date;
  endedOn: Date;
  duration: number;
  durationMinutes: number;
}

export interface VoiceChannelBreakdown {
  channelId: string;
  channelType: string;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  percentage: number;
}

export interface VoiceStatsUser {
  userId: string;
  totalDuration: number;
  totalDurationHours: number;
  totalDurationMinutes: number;
  sessionCount: number;
  uniqueChannels: number;
  favoriteChannel: string | null;
  favoriteChannelDuration: number;
  averageSessionDuration: number;
  averageSessionDurationMinutes: number;
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

// Original response (for backward compatibility)
export interface VoiceStatsResponse {
  items: unknown[];
  total: number;
  limit: number;
  offset: number;
}
