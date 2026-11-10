import { Prisma } from '@prisma/client';
import { DiscordMember } from '@nx-stolfo/api-interfaces';
import { discordDirectory } from '../../utils/discord-directory';

/**
 * The viewer's IANA time zone from `?tz=` (e.g. 'Europe/Brussels'), so hours
 * and days are bucketed the way the viewer experiences them. Missing or
 * unknown values fall back to UTC.
 */
export const getTimeZone = (tz: unknown): string => {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
};

/**
 * `issued_on` as wall-clock time in `tz`. The column is a timestamp without
 * time zone holding UTC, so it's first marked as UTC, then converted.
 * Repeated in SELECT, so queries GROUP BY column position: each embedding is
 * a separate bind parameter, which Postgres won't match as the same
 * expression.
 */
export const localIssuedOn = (tz: string) => localTime('issued_on', tz);

/** Timestamp columns the dashboard filters/buckets on (UTC wall-clock) */
export type TimeColumn = 'issued_on' | 'created_at';

/** `column` as wall-clock time in `tz` — see localIssuedOn */
export const localTime = (column: TimeColumn, tz: string) =>
  Prisma.sql`((${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;

/** Splits a millisecond duration into whole hours and remaining minutes. */
export const toDurationParts = (ms: number) => ({
  hours: Math.floor(ms / (1000 * 60 * 60)),
  minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
});

/**
 * Maps a `period` query param to the start date of that period.
 * Returns `undefined` for 'all' / unknown values so callers can decide
 * their own default (no filter, beginning of time, last month, …).
 */
export const getStartDateForPeriod = (
  period: string | undefined
): Date | undefined => {
  const now = Date.now();
  switch (period) {
    case 'day':
      return new Date(now - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now - 365 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
};

/** A whitelisted `?period=` value; anything else falls back to `fallback`. */
export const parsePeriod = <T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T
): T => (allowed.includes(raw as T) ? (raw as T) : fallback);

/** `AND <column> >= <period start>`, or nothing for 'all'. */
export const periodFilter = (period: string, column: TimeColumn = 'issued_on') => {
  const start = getStartDateForPeriod(period);
  return start ? Prisma.sql`AND ${Prisma.raw(column)} >= ${start}` : Prisma.empty;
};

/**
 * `issued_on` range of the period right before `period`, with the same
 * length (e.g. the 30 days before the last 30), or undefined for 'all'.
 */
export const previousPeriodFilter = (period: string, column: TimeColumn = 'issued_on') => {
  const start = getStartDateForPeriod(period);
  if (!start) return undefined;
  const previousStart = new Date(start.getTime() - (Date.now() - start.getTime()));
  const col = Prisma.raw(column);
  return Prisma.sql`AND ${col} >= ${previousStart} AND ${col} < ${start}`;
};

/** Member display data from the Discord directory, with an "Unknown User" fallback. */
export const memberOrUnknown = (
  members: Map<string, DiscordMember>,
  id: string
): DiscordMember =>
  members.get(id) ?? { id, username: 'Unknown User', displayName: null, avatar: null };

/** Resolves a channel id to display data, with an "Unknown Channel" fallback. */
export const getChannelData = (guildId: string, channelId: string) =>
  discordDirectory().channel(guildId, channelId) ?? {
    id: channelId,
    name: 'Unknown Channel',
    type: 'VOICE',
  };
