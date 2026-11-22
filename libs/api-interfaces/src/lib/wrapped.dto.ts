import type { ActivityCalendar, DiscordChannel, DiscordMember } from './voice-stats.dto';

/** A month of the year: voice time and messages */
export interface WrappedMonth {
  /** 1 = January */
  month: number;
  voiceMs: number;
  messages: number;
}

/** When in the day someone is in voice, from their busiest UTC hour */
export type WrappedPersona = 'Night owl' | 'Early bird' | 'Afternoon regular' | 'Evening regular';

/**
 * One member's year on one server ("Server Wrapped"), for /wrapped and
 * `…/users/:userId/wrapped?year=`. The year is the UTC calendar year; a
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
  /** Voice minutes per UTC hour (24), each session cut into the hours it covers */
  hours: number[];
  /** null without voice time */
  persona: { label: WrappedPersona; peakHour: number } | null;
  /** Daily voice minutes and messages in UTC days, for the year's activity calendar */
  days: ActivityCalendar;
  /** Longest run of voice days (10+ min in voice, UTC days) inside the year */
  longestStreak: number;
  /** Lifetime voice-hour milestones passed during the year */
  milestones: number[];
  messages: number;
  /** Voice time rank among the server's members who were in voice that year; null when they weren't */
  voiceRank: { rank: number; members: number; topPercent: number } | null;
  /** XP earned in the year, and the level before and after it */
  xp: { gained: number; levelFrom: number; levelTo: number };
  /** Games won against members, and trivia questions answered right */
  games: { rockPaperScissors: number; ticTacToe: number; trivia: number };
}

/** WrappedStats with the names the dashboard shows */
export interface VoiceStatsWrapped extends Omit<WrappedStats, 'topChannels' | 'buddies'> {
  member: DiscordMember;
  topChannels: { channel: DiscordChannel; voiceMs: number }[];
  buddies: { member: DiscordMember; togetherMs: number }[];
}
