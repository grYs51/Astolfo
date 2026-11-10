import { DashboardPeriod, DiscordMember } from './voice-stats.dto';

/** One hour of the week in the viewer's time zone (GET …/:serverId/presence) */
export interface ServerPresenceCell {
  hour: number;
  /** 0 = Sunday */
  dayOfWeek: number;
  /** Average number of members online (online, idle or dnd) in this hour */
  avgOnline: number;
}

/** A member whose online time leans to one part of the day */
export interface PresenceRhythmMember {
  member: DiscordMember;
  /** Share of their online time inside the window, 0–1 */
  share: number;
  onlineHours: number;
}

/** Server pulse: when members are online */
export interface ServerPresence {
  period: DashboardPeriod;
  /** Current members counted */
  members: number;
  /** All 168 cells */
  cells: ServerPresenceCell[];
  /** Most online between 00:00 and 05:00 (top 3, visible members only) */
  nightOwls: PresenceRhythmMember[];
  /** Most online between 05:00 and 09:00 (top 3, visible members only) */
  earlyBirds: PresenceRhythmMember[];
}

/** One member's online time (GET …/:serverId/users/:userId/presence) */
export interface UserPresence {
  period: DashboardPeriod;
  /** Time per status in ms */
  online: number;
  idle: number;
  dnd: number;
  /** online + idle + dnd of the period just before; null for 'all' */
  previousTotal: number | null;
  /** 24 values, local hour 0–23: share of that hour spent online, 0–1 */
  byHour: number[];
}
