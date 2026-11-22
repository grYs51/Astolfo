import type { DiscordChannel, DiscordMember } from './voice-stats.dto';

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
  favouriteChannelId: string | null;
  /** Who they shared a channel with most */
  topDuo: { memberId: string; togetherMs: number } | null;
  /** Month with the most voice time, 1 = January */
  peakMonth: { month: number; voiceMs: number } | null;
  /** Longest run of voice days (10+ min in voice, UTC days) inside the year */
  longestStreak: number;
  /** Lifetime voice-hour milestones passed during the year */
  milestones: number[];
  messages: number;
  /** Voice time rank among the server's members who were in voice that year; null when they weren't */
  voiceRank: { rank: number; members: number; topPercent: number } | null;
  /** XP earned in the year, and the level before and after it */
  xp: { gained: number; levelFrom: number; levelTo: number };
}

/** WrappedStats with the names the dashboard shows */
export interface VoiceStatsWrapped extends WrappedStats {
  member: DiscordMember;
  favouriteChannel: DiscordChannel | null;
  topDuoMember: DiscordMember | null;
}
