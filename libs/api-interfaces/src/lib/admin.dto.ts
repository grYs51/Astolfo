/**
 * Wire types for the owner-only admin page, GET /admin/{health,servers,usage,people,web}
 * (apps/bot/src/api/routes/admin). Counts and server names only, never member names.
 * Days are UTC `YYYY-MM-DD`, weeks the Monday they start on.
 */

export interface AdminHealth {
  uptimeSeconds: number;
  /** Short git commit of the running build, or `unknown` */
  commit: string;
  /** pingMs is null until the first heartbeat (and always in mock mode) */
  gateway: { status: string; pingMs: number | null };
  memoryRssBytes: number;
  /** p99 event loop lag from prom-client's default metrics */
  eventLoopLagSeconds: number | null;
  openVoiceSessions: number;
  currentStatuses: number;
  /** Rows a crash left open, closed at the last startup */
  danglingAtStartup: { voiceSessions: number; statuses: number };
  database: { sizeBytes: number; tables: { name: string; rows: number }[] };
}

export interface AdminServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  /** When the bot joined; null when unknown (mock mode) */
  joinedAt: string | null;
  voiceHours30d: number;
  messages30d: number;
  /** Latest voice or message activity, ever */
  lastActivity: string | null;
  /** Labels of the enabled guild toggles */
  toggles: string[];
  digest: boolean;
}

export interface AdminServers {
  servers: AdminServer[];
  /** Weeks with at least one join or leave */
  joinsPerWeek: { week: string; joins: number; leaves: number }[];
}

export interface AdminCommandUsage {
  name: string;
  kind: 'prefix' | 'slash';
  total: number;
  last30d: number;
  errors: number;
}

export interface AdminRouteStats {
  method: string;
  route: string;
  requests: number;
  /** Share of 5xx responses, 0–1 */
  errorRate: number;
  /** Upper bound of the histogram bucket holding the 95th percentile, since the last restart. Null: no requests since then (or slower than the top bucket). */
  p95Ms: number | null;
}

export interface AdminUsage {
  /** Every registered command, unused ones with zeros */
  commands: AdminCommandUsage[];
  /** Last 30 days, every day present */
  daily: { day: string; prefix: number; slash: number; errors: number }[];
  /** Most requested routes first */
  routes: AdminRouteStats[];
}

export interface AdminPeople {
  /** Distinct members with voice or messages per day, last 90 days, every day present */
  daily: { day: string; members: number }[];
  dau: number;
  wau: number;
  mau: number;
  /** Members whose first activity falls in that week, last 13 weeks */
  firstSeenPerWeek: { week: string; members: number }[];
  /** Active 30–60 days ago, not in the last 30 */
  churned: number;
  signIns: { last7d: number; last30d: number; total: number; beforeTracking: number };
  /** Distinct logged-in users with an unexpired dashboard session */
  liveWebUsers: number;
}

export interface AdminWeb {
  /** Last 90 days, every day present */
  daily: { day: string; views: number; visitors: number }[];
  /** Route patterns, most viewed first, last 90 days */
  topPages: { path: string; views: number; visitors: number }[];
}

/**
 * Admin actions: POST /admin/actions/{digest,leave,close-stuck-sessions,broadcast} and PUT /admin/notice.
 * The notice is also served to everyone, logged in or not, by GET /notice.
 */
export interface AdminGuildAction {
  guildId: string;
}

/** The maintenance notice; null when none is set. At most 300 characters. */
export interface AppNotice {
  text: string | null;
}

export interface AdminClosedSessions {
  closed: number;
}

/** At most 1,000 characters */
export interface AdminBroadcast {
  text: string;
}

/** The broadcast's 202: how many servers it will post to; the posting runs in the background */
export interface AdminBroadcastQueued {
  queued: number;
}

/** Logged by the bot once the background broadcast is done */
export interface AdminBroadcastResult {
  posted: number;
  failed: number;
}
