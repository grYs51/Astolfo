import { Prisma } from '@prisma/client';
import type { Db } from '../db';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';
import { periodWindows, StatsPeriod, TimeWindow, windowFilter } from './windows';
import { crossedMilestones, MILESTONE_HOURS } from './milestones';
import { HABIT_SUMS, HabitRow, toHabits } from './habits-sql';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';
import { endsAfter, NOW_UTC, ONLINE, presenceWindowStart } from '../api/routes/features/voice-stats/presence-sql';

/**
 * Stats for the Discord-side features (/stats, /profile, weekly digest). Same rules as
 * the dashboard API: voice totals count VOICE rows only (the other types
 * overlap them) and open sessions count live.
 */

type QueryDb = Pick<Db, '$queryRaw'>;

/** Duration of a voice_stats row in ms; open sessions count until now */
const durationMs = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return Prisma.raw(
    `EXTRACT(EPOCH FROM (COALESCE(${p}ended_on, NOW()) - ${p}issued_on)) * 1000`
  );
};

/** Like durationMs, but only the part before `cap` */
const durationBeforeMs = (cap: Date) =>
  Prisma.sql`EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_on, NOW()), ${cap}) - issued_on)) * 1000`;

/** Overlap of two voice_stats rows (aliases a/b or me/other) in ms */
const overlapMs = (x: string, y: string) =>
  Prisma.raw(
    `EXTRACT(EPOCH FROM (LEAST(COALESCE(${x}.ended_on, NOW()), COALESCE(${y}.ended_on, NOW())) - GREATEST(${x}.issued_on, ${y}.issued_on))) * 1000`
  );

const voiceTotal = async (db: QueryDb, guildId: string, window: TimeWindow, memberId?: string) => {
  const member = memberId ? Prisma.sql`AND member_id = ${memberId}` : Prisma.empty;
  const [row] = await db.$queryRaw<{ total: bigint; sessions: bigint }[]>`
    SELECT COALESCE(SUM(${durationMs()}), 0)::bigint AS total, COUNT(*)::bigint AS sessions
    FROM voice_stats
    WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
      ${member}
      ${windowFilter('issued_on', window)}
  `;
  return { total: Number(row.total), sessions: Number(row.sessions) };
};

const messageCount = async (db: QueryDb, guildId: string, window: TimeWindow, memberId?: string) => {
  const member = memberId ? Prisma.sql`AND user_id = ${memberId}` : Prisma.empty;
  const [row] = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM message_stats
    WHERE guild_id = ${guildId}
      ${member}
      ${windowFilter('created_at', window)}
  `;
  return Number(row.count);
};

/** The channel a member spent the most voice time in */
const favouriteChannel = async (db: QueryDb, guildId: string, memberId: string, window: TimeWindow) => {
  const [row] = await db.$queryRaw<{ channel_id: string }[]>`
    SELECT channel_id
    FROM voice_stats
    WHERE guild_id = ${guildId} AND member_id = ${memberId} AND type = ${VOICE_TYPE.VOICE}
      ${windowFilter('issued_on', window)}
    GROUP BY channel_id
    ORDER BY SUM(${durationMs()}) DESC
    LIMIT 1
  `;
  return row?.channel_id;
};

// ── Streaks ─────────────────────────────────────────────────────────────────

/** Voice time a UTC day needs to count for a streak (a quick join-and-leave doesn't) */
const VOICE_DAY_MS = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export interface Streak {
  memberId: string;
  /** Voice days in a row ending today or yesterday (UTC), so it holds until you've joined today */
  current: number;
  longest: number;
}

/**
 * Voice-day streaks per member, best current streak first. A voice day is a
 * UTC day with at least 10 minutes in voice. Measured at `now`: sessions
 * started later are ignored, so a past date gives the streaks as they were then.
 * shortcut: a session counts for the day it started, split by day if anyone notices.
 */
export const getStreaks = async (
  db: QueryDb,
  guildId: string,
  opts: { memberIds?: string[]; limit?: number },
  now = new Date()
): Promise<Streak[]> => {
  if (opts.memberIds?.length === 0) return [];
  const members = opts.memberIds
    ? Prisma.sql`AND member_id IN (${Prisma.join(opts.memberIds)})`
    : Prisma.empty;
  const today = now.toISOString().slice(0, 10);
  const rows = await db.$queryRaw<{ member_id: string; current: number; longest: number }[]>`
    WITH days AS (
      SELECT member_id, issued_on::date AS day
      FROM voice_stats
      WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} AND issued_on < ${now}
        ${members}
      GROUP BY member_id, issued_on::date
      HAVING SUM(${durationMs()}) >= ${VOICE_DAY_MS}
    ),
    -- Gaps and islands: consecutive days share the same day - row_number
    runs AS (
      SELECT member_id, COUNT(*)::int AS length, MAX(day) AS last_day
      FROM (
        SELECT member_id, day,
          day - (ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY day))::int AS island
        FROM days
      ) numbered
      GROUP BY member_id, island
    )
    SELECT member_id,
      COALESCE(MAX(length) FILTER (WHERE last_day >= ${today}::date - 1), 0)::int AS current,
      MAX(length)::int AS longest
    FROM runs
    GROUP BY member_id
    ORDER BY current DESC, longest DESC, member_id
    ${opts.limit ? Prisma.sql`LIMIT ${opts.limit}` : Prisma.empty}
  `;
  return rows.map((row) => ({ memberId: row.member_id, current: row.current, longest: row.longest }));
};

/** One member's streak */
export const getMemberStreak = async (db: QueryDb, guildId: string, memberId: string, now = new Date()) => {
  const [streak] = await getStreaks(db, guildId, { memberIds: [memberId] }, now);
  return { current: streak?.current ?? 0, longest: streak?.longest ?? 0 };
};

/** All-time voice ms of one member */
export const lifetimeVoiceMs = async (db: QueryDb, guildId: string, memberId: string, now = new Date()) =>
  (await voiceTotal(db, guildId, { to: now }, memberId)).total;

// ── /stats ──────────────────────────────────────────────────────────────────

export interface MemberSummary {
  voiceMs: number;
  /** null when there's no previous period ('all') */
  previousVoiceMs: number | null;
  sessions: number;
  messages: number;
  previousMessages: number | null;
  /** Rank by messages among the server's members (1 = most) */
  messageRank?: number;
  /** Who they shared a channel with most */
  companions: { memberId: string; togetherMs: number }[];
  streak: { current: number; longest: number };
  /** All-time voice ms, for the next milestone */
  lifetimeMs: number;
}

/** The member's rank in `totals` (rows of member_id, total), and how many members it has; no row when they aren't in it */
const rankIn = (db: QueryDb, memberId: string, totals: Prisma.Sql) =>
  db.$queryRaw<{ members: bigint; rank: bigint | null }[]>`
    WITH totals AS (${totals})
    SELECT
      (SELECT COUNT(*) FROM totals)::bigint AS members,
      (SELECT COUNT(*) + 1 FROM totals
        WHERE total > (SELECT total FROM totals WHERE member_id = ${memberId})
      )::bigint AS rank
    WHERE EXISTS (SELECT 1 FROM totals WHERE member_id = ${memberId})
  `;

/** Each member's voice ms in the window (member_id, total) */
const voiceTotals = (guildId: string, window: TimeWindow) => Prisma.sql`
  SELECT member_id, SUM(${durationMs()}) AS total
  FROM voice_stats
  WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
    ${windowFilter('issued_on', window)}
  GROUP BY member_id`;

export interface VoiceNeighbour {
  memberId: string;
  voiceMs: number;
  /** 1 = most voice time; ties broken by member id so the list is stable */
  rank: number;
  /** Members on the leaderboard */
  members: number;
}

/**
 * The member and whoever is just above and below them by voice time in the
 * period (three rows, or fewer on a short leaderboard), like the dashboard's
 * voice ranking. Empty when the member has no voice time.
 */
export const getVoiceNeighbours = async (
  db: QueryDb,
  guildId: string,
  memberId: string,
  period: StatsPeriod,
  now = new Date()
): Promise<VoiceNeighbour[]> => {
  const rows = await db.$queryRaw<{ member_id: string; total: number; rank: number; members: number }[]>`
    WITH totals AS (${voiceTotals(guildId, periodWindows(period, now).current)}),
    ranked AS (
      SELECT member_id, total,
        ROW_NUMBER() OVER (ORDER BY total DESC, member_id)::int AS rank,
        COUNT(*) OVER ()::int AS members
      FROM totals
    ),
    -- The first row shown: one above the member, kept inside the leaderboard
    me AS (SELECT GREATEST(1, LEAST(rank - 1, members - 2)) AS first FROM ranked WHERE member_id = ${memberId})
    SELECT member_id, total::float8 AS total, rank, members
    FROM ranked, me
    WHERE rank BETWEEN me.first AND me.first + 2
    ORDER BY rank
  `;
  return rows.map((row) => ({ memberId: row.member_id, voiceMs: Number(row.total), rank: row.rank, members: row.members }));
};

/**
 * Time spent online (online, idle or dnd) in the period and its share of the
 * period, like the dashboard's online meter. Statuses have no guild: the
 * caller checks the member is in the server before asking.
 */
export const getMemberOnline = async (db: QueryDb, memberId: string, period: StatsPeriod, now = new Date()) => {
  const lo = await presenceWindowStart(db, period, [memberId]);
  const [row] = await db.$queryRaw<{ ms: number | null }[]>`
    SELECT SUM(EXTRACT(EPOCH FROM COALESCE(ended_at, ${NOW_UTC}) - GREATEST(created_at, ${lo}::timestamp)) * 1000)::float8 AS ms
    FROM user_statuses
    WHERE user_id = ${memberId}
      AND ${ONLINE}
      AND ${endsAfter(lo)}
  `;
  const ms = Number(row?.ms ?? 0);
  const span = now.getTime() - lo.getTime();
  return { ms, share: span > 0 ? Math.min(1, ms / span) : 0 };
};

/** Camera, streaming, muted and deafened time in the period (dashboard profile and the stats card) */
export const getMemberHabits = async (db: QueryDb, guildId: string, memberId: string, period: StatsPeriod, now = new Date()) => {
  const [row] = await db.$queryRaw<HabitRow[]>`
    SELECT ${HABIT_SUMS}
    FROM voice_stats
    WHERE guild_id = ${guildId} AND member_id = ${memberId}
      ${windowFilter('issued_on', periodWindows(period, now).current)}
  `;
  return toHabits(row);
};

export const getMemberSummary = async (
  db: QueryDb,
  guildId: string,
  memberId: string,
  period: StatsPeriod,
  now = new Date()
): Promise<MemberSummary> => {
  const { current, previous } = periodWindows(period, now);

  const [voice, previousVoice, messages, previousMessages, [messageRank], companions, streak, lifetimeMs] =
    await Promise.all([
      voiceTotal(db, guildId, current, memberId),
      previous ? voiceTotal(db, guildId, previous, memberId) : null,
      messageCount(db, guildId, current, memberId),
      previous ? messageCount(db, guildId, previous, memberId) : null,
      rankIn(
        db,
        memberId,
        Prisma.sql`
          SELECT user_id AS member_id, COUNT(*) AS total
          FROM message_stats
          WHERE guild_id = ${guildId}
            ${windowFilter('created_at', current)}
          GROUP BY user_id`
      ),
      db.$queryRaw<{ member_id: string; together: bigint }[]>`
        SELECT other.member_id, SUM(${overlapMs('me', 'other')})::bigint AS together
        FROM voice_stats me
        JOIN voice_stats other
          ON other.guild_id = me.guild_id
         AND other.channel_id = me.channel_id
         AND other.type = ${VOICE_TYPE.VOICE}
         AND other.member_id <> me.member_id
         AND other.issued_on < COALESCE(me.ended_on, NOW())
         AND COALESCE(other.ended_on, NOW()) > me.issued_on
        WHERE me.guild_id = ${guildId} AND me.member_id = ${memberId} AND me.type = ${VOICE_TYPE.VOICE}
          ${windowFilter('me.issued_on', current)}
        GROUP BY other.member_id
        ORDER BY together DESC
        LIMIT 3
      `,
      getMemberStreak(db, guildId, memberId, now),
      lifetimeVoiceMs(db, guildId, memberId, now),
    ]);

  return {
    voiceMs: voice.total,
    previousVoiceMs: previousVoice ? previousVoice.total : null,
    sessions: voice.sessions,
    messages,
    previousMessages,
    messageRank: messageRank?.rank != null ? Number(messageRank.rank) : undefined,
    companions: companions.map((row) => ({
      memberId: row.member_id,
      togetherMs: Number(row.together),
    })),
    streak,
    lifetimeMs,
  };
};

// ── /duo ────────────────────────────────────────────────────────────────────

export interface Duo {
  /** Time a and b were in the same channel at the same time */
  togetherMs: number;
  aVoiceMs: number;
  bVoiceMs: number;
  /** The channel they spent the most time in together */
  topChannelId?: string;
}

/** Time two members spent together in voice */
export const getDuo = async (
  db: QueryDb,
  guildId: string,
  aId: string,
  bId: string,
  period: StatsPeriod,
  now = new Date()
): Promise<Duo> => {
  const { current } = periodWindows(period, now);
  const [[top], a, b] = await Promise.all([
    // Same join as the companions in getMemberSummary, for one pair, with both sessions in the window so it's symmetric;
    // the pair's total rides along on the top channel
    db.$queryRaw<{ channel_id: string; total: bigint }[]>`
      SELECT a.channel_id, SUM(SUM(${overlapMs('a', 'b')})) OVER ()::bigint AS total
      FROM voice_stats a
      JOIN voice_stats b
        ON b.guild_id = a.guild_id
       AND b.channel_id = a.channel_id
       AND b.type = ${VOICE_TYPE.VOICE}
       AND b.member_id = ${bId}
       AND b.issued_on < COALESCE(a.ended_on, NOW())
       AND COALESCE(b.ended_on, NOW()) > a.issued_on
       ${windowFilter('b.issued_on', current)}
      WHERE a.guild_id = ${guildId} AND a.member_id = ${aId} AND a.type = ${VOICE_TYPE.VOICE}
        ${windowFilter('a.issued_on', current)}
      GROUP BY a.channel_id
      ORDER BY SUM(${overlapMs('a', 'b')}) DESC
      LIMIT 1
    `,
    voiceTotal(db, guildId, current, aId),
    voiceTotal(db, guildId, current, bId),
  ]);
  return {
    togetherMs: Number(top?.total ?? 0),
    aVoiceMs: a.total,
    bVoiceMs: b.total,
    topChannelId: top?.channel_id,
  };
};

// ── /profile ────────────────────────────────────────────────────────────────

export interface MemberProfile {
  /** First voice row anyone has on the server: when tracking began */
  trackingSince?: Date;
  sessions: number;
  voiceMs: number;
  longestSessionMs: number;
  /** Capped to the voice time, like the dashboard's voice habits */
  mutedMs: number;
  streamingMs: number;
  lastWeekMs: number;
  favouriteChannelId?: string;
  rps: { wins: number; ties: number; losses: number };
}

/** One member's all-time profile on a server */
export const getMemberProfile = async (
  db: QueryDb,
  guildId: string,
  memberId: string,
  now = new Date()
): Promise<MemberProfile> => {
  const weekAgo = new Date(now.getTime() - 7 * 24 * HOUR);
  const [[voice], favouriteChannelId, [rps]] = await Promise.all([
    db.$queryRaw<(HabitRow & { since: Date | null; sessions: bigint; longest: bigint; last_week: bigint })[]>`
      SELECT
        (SELECT MIN(issued_on) FROM voice_stats WHERE guild_id = ${guildId}) AS since,
        COUNT(*) FILTER (WHERE type = ${VOICE_TYPE.VOICE})::bigint AS sessions,
        COALESCE(MAX(${durationMs()}) FILTER (WHERE type = ${VOICE_TYPE.VOICE}), 0)::bigint AS longest,
        COALESCE(SUM(${durationMs()}) FILTER (WHERE type = ${VOICE_TYPE.VOICE} AND issued_on >= ${weekAgo}), 0)::bigint AS last_week,
        ${HABIT_SUMS}
      FROM voice_stats
      WHERE guild_id = ${guildId} AND member_id = ${memberId} AND issued_on < ${now}
    `,
    favouriteChannel(db, guildId, memberId, { to: now }),
    db.$queryRaw<{ wins: bigint; ties: bigint; losses: bigint }[]>`
      SELECT COUNT(*) FILTER (WHERE gp.result = ${SCORING.WIN})::bigint AS wins,
             COUNT(*) FILTER (WHERE gp.result = ${SCORING.TIE})::bigint AS ties,
             COUNT(*) FILTER (WHERE gp.result = ${SCORING.LOSS})::bigint AS losses
      FROM game_player gp
      JOIN game_result gr ON gr.id = gp.game_result_id
      WHERE gp.user_id = ${memberId}
        AND gr.guild_id = ${guildId}
        AND gr.game_type_id = ${GAME_TYPES.ROCK_PAPER_SCISSORS}
    `,
  ]);
  const habits = toHabits(voice);
  return {
    trackingSince: voice?.since ?? undefined,
    sessions: Number(voice?.sessions ?? 0),
    voiceMs: habits.voice,
    longestSessionMs: Number(voice?.longest ?? 0),
    mutedMs: habits.muted,
    streamingMs: habits.streaming,
    lastWeekMs: Number(voice?.last_week ?? 0),
    favouriteChannelId,
    rps: { wins: Number(rps?.wins ?? 0), ties: Number(rps?.ties ?? 0), losses: Number(rps?.losses ?? 0) },
  };
};

// ── Weekly digest ───────────────────────────────────────────────────────────

export interface ServerDigest {
  voiceMs: number;
  previousVoiceMs: number;
  messages: number;
  previousMessages: number;
  /** In voice or wrote a message */
  activeMembers: number;
  topVoice: { memberId: string; ms: number }[];
  topMessages: { memberId: string; count: number }[];
  bestDuo?: { a: string; b: string; togetherMs: number };
  /** UTC day with the most voice time */
  busiestDay?: { day: Date; ms: number };
  /** Longest current voice streaks (2+ days) */
  topStreaks: { memberId: string; days: number }[];
  /** Members who reached a lifetime voice milestone in the window (highest one each) */
  milestones: { memberId: string; hours: number }[];
}

/** A server's week (or any window) for a public channel post */
export const getServerDigest = async (
  db: QueryDb,
  guildId: string,
  window: Required<TimeWindow>,
  previous: Required<TimeWindow>
): Promise<ServerDigest> => {
  const [voice, previousVoice, messages, previousMessages, [active], topVoice, topMessages, [duo], [day], streaks, lifetimes] =
    await Promise.all([
      voiceTotal(db, guildId, window),
      voiceTotal(db, guildId, previous),
      messageCount(db, guildId, window),
      messageCount(db, guildId, previous),
      db.$queryRaw<{ members: bigint }[]>`
        SELECT COUNT(*)::bigint AS members FROM (
          SELECT member_id AS id FROM voice_stats
          WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} ${windowFilter('issued_on', window)}
          UNION
          SELECT user_id AS id FROM message_stats
          WHERE guild_id = ${guildId} ${windowFilter('created_at', window)}
        ) active
      `,
      db.$queryRaw<{ member_id: string; total: bigint }[]>`
        SELECT member_id, SUM(${durationMs()})::bigint AS total
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
          ${windowFilter('issued_on', window)}
        GROUP BY member_id
        -- Ties by id, like the weekly top 3 XP bonus (xp/grant.ts), so the names match
        ORDER BY total DESC, member_id
        LIMIT 3
      `,
      db.$queryRaw<{ user_id: string; count: bigint }[]>`
        SELECT user_id, COUNT(*)::bigint AS count
        FROM message_stats
        WHERE guild_id = ${guildId}
          ${windowFilter('created_at', window)}
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 3
      `,
      // Pair with the most time in the same channel at the same time
      db.$queryRaw<{ a: string; b: string; together: bigint }[]>`
        SELECT a.member_id AS a, b.member_id AS b, SUM(${overlapMs('a', 'b')})::bigint AS together
        FROM voice_stats a
        JOIN voice_stats b
          ON b.guild_id = a.guild_id
         AND b.channel_id = a.channel_id
         AND b.type = ${VOICE_TYPE.VOICE}
         AND a.member_id < b.member_id
         AND b.issued_on < COALESCE(a.ended_on, NOW())
         AND COALESCE(b.ended_on, NOW()) > a.issued_on
        WHERE a.guild_id = ${guildId} AND a.type = ${VOICE_TYPE.VOICE}
          ${windowFilter('a.issued_on', window)}
        GROUP BY a.member_id, b.member_id
        ORDER BY together DESC
        LIMIT 1
      `,
      db.$queryRaw<{ day: Date; total: bigint }[]>`
        SELECT DATE_TRUNC('day', issued_on) AS day, SUM(${durationMs()})::bigint AS total
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
          ${windowFilter('issued_on', window)}
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 1
      `,
      // As of the end of the week, so a late post or a mid-week preview still shows that week
      getStreaks(db, guildId, { limit: 3 }, window.to),
      // Lifetime voice before and at the end of the window, for milestones crossed in it
      db.$queryRaw<{ member_id: string; before: bigint; after: bigint }[]>`
        SELECT member_id,
          COALESCE(SUM(${durationBeforeMs(window.from)}) FILTER (WHERE issued_on < ${window.from}), 0)::bigint AS before,
          SUM(${durationBeforeMs(window.to)})::bigint AS after
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} AND issued_on < ${window.to}
        GROUP BY member_id
        HAVING SUM(${durationBeforeMs(window.to)}) >= ${MILESTONE_HOURS[0] * HOUR}
      `,
    ]);

  const milestones = lifetimes
    .map((row) => ({
      memberId: row.member_id,
      hours: Math.max(0, ...crossedMilestones(Number(row.before), Number(row.after))),
    }))
    .filter((m) => m.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    // Keeps the embed field under Discord's 1024 characters
    .slice(0, 10);

  return {
    voiceMs: voice.total,
    previousVoiceMs: previousVoice.total,
    messages,
    previousMessages,
    activeMembers: Number(active.members),
    topVoice: topVoice.map((row) => ({ memberId: row.member_id, ms: Number(row.total) })),
    topMessages: topMessages.map((row) => ({ memberId: row.user_id, count: Number(row.count) })),
    bestDuo: duo ? { a: duo.a, b: duo.b, togetherMs: Number(duo.together) } : undefined,
    busiestDay: day && Number(day.total) > 0 ? { day: day.day, ms: Number(day.total) } : undefined,
    topStreaks: streaks.filter((s) => s.current >= 2).map((s) => ({ memberId: s.memberId, days: s.current })),
    milestones,
  };
};
