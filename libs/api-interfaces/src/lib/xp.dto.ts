import type { DashboardPeriod, DateLike, DiscordMember } from './voice-stats.dto';

/**
 * The XP rules: one global set, tuned on the owner's /admin panel (defaults in the bot's `xp/rules.ts`).
 * Going from level L to L+1 costs `levelStep·L + levelBase` XP.
 */
export interface XpRules {
  levelStep: number;
  levelBase: number;
  /** A voice minute earns `amounts.voiceMinute × crowd × deafened × stay × media` */
  voice: {
    /** Crowd when nobody else is in the channel */
    alone: number;
    oneOther: number;
    /** Added per person past the first */
    perExtra: number;
    crowdCap: number;
    /** Factor while deafened */
    deafened: number;
    /** Added per `stayEveryMin` in voice without a break */
    stayStep: number;
    stayEveryMin: number;
    stayCap: number;
    /** Added while the camera is on */
    camera: number;
    /** Added while screen sharing with someone else in the channel */
    screenShare: number;
  };
  /** XP per grant; 0 turns a source off */
  amounts: {
    voiceMinute: number;
    starter: number;
    message: number;
    streakDay: number;
    gameWin: number;
    /** Added per win in a row before this one, up to `gameStreakCap` */
    gameStreakStep: number;
    gameStreakCap: number;
    reconnect: number;
    welcome: number;
    milestone: number;
    /** The week's top 3 by voice time */
    weekly: [number, number, number];
  };
  thresholds: {
    /** Minutes together for the starter, reconnect and welcome bonuses */
    togetherMin: number;
    /** Days apart before a call together counts as a reconnect */
    reconnectDays: number;
    /** Days of tracking on a server before first sessions count as newcomers */
    welcomeAfterDays: number;
    startersPerDay: number;
    /** Lifetime voice hours that earn the milestone bonus, rising */
    milestoneHours: number[];
  };
}

/** GET /admin/xp-rules */
export interface AdminXpRules {
  rules: XpRules;
  defaults: XpRules;
  /** null = the defaults apply */
  updatedAt: DateLike | null;
}

/** 400 from PUT /admin/xp-rules: `field` is the dotted path of the bad value, such as `voice.alone` */
export interface XpRulesError {
  error: string;
  field?: string;
}

/** POST /admin/actions/recalculate-xp */
export interface AdminRecalculateQueued {
  queued: true;
}

export type XpSource = 'VOICE' | 'STARTER' | 'RECONNECT' | 'WELCOME' | 'MILESTONE' | 'WEEKLY' | 'MESSAGE' | 'STREAK' | 'GAME';

/** One stretch of a voice session where the multiplier and the people present hold still */
export interface XpSegment {
  /** ms since epoch */
  from: number;
  to: number;
  /** The others in the channel who weren't deafened */
  memberIds: string[];
  deaf: boolean;
  /** The factors at the time of the grant: crowd × (deafened) × stay × media = multiplier */
  crowd: number;
  stay: number;
  /** 1 + the camera and screen-share bonuses */
  media: number;
  camera: boolean;
  streaming: boolean;
  multiplier: number;
}

/** A member's grants of one source on a server, all time */
export interface XpSourceTotal {
  source: XpSource;
  /** Grants: voice sessions, message minutes, streak days, games won, bonuses */
  count: number;
  xp: number;
}

/** Level progress for a total */
export interface XpLevel {
  xp: number;
  level: number;
  /** XP the current level started at, and where the next one starts */
  levelXp: number;
  nextLevelXp: number;
}

/** The XP a closed voice session earned, with its step line for the session chart */
export interface VoiceSessionXp {
  amount: number;
  segments: XpSegment[];
  /** Everyone named in the segments */
  people: Record<string, DiscordMember>;
}

/** GET �/:serverId/xp-leaderboard: XP earned in the period, top first (up to 100, so the viewer's rank is known) */
export interface XpLeaderboard {
  period: DashboardPeriod;
  leaderboard: { member: DiscordMember; xp: number }[];
}
