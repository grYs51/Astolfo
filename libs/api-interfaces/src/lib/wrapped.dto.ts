import type { ActivityCalendar, DiscordChannel, DiscordMember } from './voice-stats.dto';

/** A month of the year: voice time, messages and XP earned */
export interface WrappedMonth {
  /** 1 = January */
  month: number;
  voiceMs: number;
  messages: number;
  xp: number;
}

/**
 * XP sources as Wrapped groups them: voice (VOICE), messages (MESSAGE), games (GAME, TRIVIA),
 * streaks (STREAK), bonuses (STARTER, RECONNECT, WELCOME, MILESTONE, WEEKLY)
 */
export type WrappedXpGroup = 'voice' | 'messages' | 'games' | 'streaks' | 'bonuses';

/** A rank on the server, and the share of ranked members at or above it */
export interface WrappedRank {
  rank: number;
  members: number;
  topPercent: number;
}

/** When in the day someone is in voice, from their busiest hour (in the time zone of the request) */
export type WrappedPersona = 'Night owl' | 'Early bird' | 'Afternoon regular' | 'Evening regular';

/**
 * One member's year on one server ("Server Wrapped"), for /wrapped and
 * `…/users/:userId/wrapped?year=&tz=`. The year is the calendar year in `tz` (UTC on the card); a
 * session counts for the year it started, open sessions count live.
 */
export interface WrappedStats {
  year: number;
  /** VOICE rows only */
  voiceMs: number;
  sessions: number;
  longestSessionMs: number;
  /** Most voice time first, up to 3; the first is the favourite */
  topChannels: { channelId: string; voiceMs: number }[];
  /** Who they shared a channel with most, up to 5; the first is the top duo */
  buddies: { memberId: string; togetherMs: number }[];
  /** All 12, empty months as zero */
  months: WrappedMonth[];
  /** Month with the most voice time */
  peakMonth: WrappedMonth | null;
  /** Voice minutes per hour of the day in `tz` (24), each session cut into the hours it covers */
  hours: number[];
  /** null without voice time */
  persona: { label: WrappedPersona; peakHour: number } | null;
  /** Daily voice minutes and messages in `tz` days, for the year's activity calendar */
  days: ActivityCalendar;
  /** Longest run of voice days (10+ min in voice, UTC days) inside the year */
  longestStreak: number;
  /** Lifetime voice-hour milestones passed during the year */
  milestones: number[];
  messages: number;
  /** Voice time rank among the server's members who were in voice that year; null when they weren't */
  voiceRank: WrappedRank | null;
  /** XP earned in the year (`xp_events.created_at` in the year) */
  xp: {
    gained: number;
    /** Level before the year and at its end */
    levelFrom: number;
    levelTo: number;
    levelUps: number;
    /** By XP earned that year, among members who earned any; null when they earned none */
    rank: WrappedRank | null;
    /** Every group, in drawing order; `share` 0–1 of `gained` */
    sources: { group: WrappedXpGroup; xp: number; share: number }[];
    /** Day (in `tz`) with the most XP */
    bestDay: { date: string; xp: number } | null;
    /** Weekly top 3 finishes (WEEKLY rows) */
    weeklyTop3: number;
  };
  /** Games won against members, and trivia questions answered right */
  games: { rockPaperScissors: number; ticTacToe: number; trivia: number };
}

/** WrappedStats with the names the dashboard shows */
export interface VoiceStatsWrapped extends Omit<WrappedStats, 'topChannels' | 'buddies'> {
  serverName: string;
  member: DiscordMember;
  topChannels: { channel: DiscordChannel; voiceMs: number }[];
  buddies: { member: DiscordMember; togetherMs: number }[];
}
