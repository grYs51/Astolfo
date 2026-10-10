import { Prisma } from '@prisma/client';
import type { Db } from '../db';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';
import { visibleMembersOnly } from '../utils/privacy';
import { periodWindows, StatsPeriod, TimeWindow, windowFilter } from './windows';

/**
 * Stats for the Discord-side features (/stats, weekly digest). Same rules as
 * the dashboard API: voice totals count VOICE rows only (the other types
 * overlap them), open sessions count live, and lists that name members leave
 * out members who hide from others.
 */

type QueryDb = Pick<Db, '$queryRaw'>;

/** Duration of a voice_stats row in ms; open sessions count until now */
const durationMs = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return Prisma.raw(
    `EXTRACT(EPOCH FROM (COALESCE(${p}ended_on, NOW()) - ${p}issued_on)) * 1000`
  );
};

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

// ── /stats ──────────────────────────────────────────────────────────────────

export interface MemberSummary {
  voiceMs: number;
  /** null when there's no previous period ('all') */
  previousVoiceMs: number | null;
  sessions: number;
  messages: number;
  previousMessages: number | null;
  /** Rank by voice time among members the viewer can see (1 = most) */
  voiceRank?: number;
  rankedMembers: number;
  favouriteChannelId?: string;
  /** Who they shared a channel with most (members visible to them) */
  companions: { memberId: string; togetherMs: number }[];
}

export const getMemberSummary = async (
  db: QueryDb,
  guildId: string,
  memberId: string,
  period: StatsPeriod,
  now = new Date()
): Promise<MemberSummary> => {
  const { current, previous } = periodWindows(period, now);

  const [voice, previousVoice, messages, previousMessages, [rank], [favourite], companions] =
    await Promise.all([
      voiceTotal(db, guildId, current, memberId),
      previous ? voiceTotal(db, guildId, previous, memberId) : null,
      messageCount(db, guildId, current, memberId),
      previous ? messageCount(db, guildId, previous, memberId) : null,
      db.$queryRaw<{ members: bigint; rank: bigint | null }[]>`
        WITH totals AS (
          SELECT member_id, SUM(${durationMs()}) AS total
          FROM voice_stats
          WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
            ${windowFilter('issued_on', current)}
            ${visibleMembersOnly('member_id', memberId)}
          GROUP BY member_id
        )
        SELECT
          (SELECT COUNT(*) FROM totals)::bigint AS members,
          (SELECT COUNT(*) + 1 FROM totals
            WHERE total > (SELECT total FROM totals WHERE member_id = ${memberId})
          )::bigint AS rank
        WHERE EXISTS (SELECT 1 FROM totals WHERE member_id = ${memberId})
      `,
      db.$queryRaw<{ channel_id: string }[]>`
        SELECT channel_id
        FROM voice_stats
        WHERE guild_id = ${guildId} AND member_id = ${memberId} AND type = ${VOICE_TYPE.VOICE}
          ${windowFilter('issued_on', current)}
        GROUP BY channel_id
        ORDER BY SUM(${durationMs()}) DESC
        LIMIT 1
      `,
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
         ${visibleMembersOnly('other.member_id', memberId)}
        WHERE me.guild_id = ${guildId} AND me.member_id = ${memberId} AND me.type = ${VOICE_TYPE.VOICE}
          ${windowFilter('me.issued_on', current)}
        GROUP BY other.member_id
        ORDER BY together DESC
        LIMIT 3
      `,
    ]);

  return {
    voiceMs: voice.total,
    previousVoiceMs: previousVoice ? previousVoice.total : null,
    sessions: voice.sessions,
    messages,
    previousMessages,
    voiceRank: rank?.rank != null ? Number(rank.rank) : undefined,
    rankedMembers: rank ? Number(rank.members) : 0,
    favouriteChannelId: favourite?.channel_id,
    companions: companions.map((row) => ({
      memberId: row.member_id,
      togetherMs: Number(row.together),
    })),
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
}

/**
 * A server's week (or any window) for a public channel post: hidden members
 * are counted in totals but never named.
 */
export const getServerDigest = async (
  db: QueryDb,
  guildId: string,
  window: Required<TimeWindow>,
  previous: Required<TimeWindow>
): Promise<ServerDigest> => {
  // Public output: no viewer exception, every hidden member is left out
  const everyone = '';

  const [voice, previousVoice, messages, previousMessages, [active], topVoice, topMessages, [duo], [day]] =
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
          ${visibleMembersOnly('member_id', everyone)}
        GROUP BY member_id
        ORDER BY total DESC
        LIMIT 3
      `,
      db.$queryRaw<{ user_id: string; count: bigint }[]>`
        SELECT user_id, COUNT(*)::bigint AS count
        FROM message_stats
        WHERE guild_id = ${guildId}
          ${windowFilter('created_at', window)}
          ${visibleMembersOnly('user_id', everyone)}
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
          ${visibleMembersOnly('a.member_id', everyone)}
          ${visibleMembersOnly('b.member_id', everyone)}
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
    ]);

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
  };
};
