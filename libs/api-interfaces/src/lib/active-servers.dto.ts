/**
 * Wire types for GET /features/active-servers
 * (apps/bot/src/api/routes/features/active-servers/getActiveServers.ts).
 */
export interface guild {
  /** Missing when the guild is no longer in the bot's cache. */
  icon?: string | null;
  name?: string;
  id: string;
  /** Seconds (not ms) — aggregated in SQL. */
  totalDuration: number;
}

export type guilds = guild[];
