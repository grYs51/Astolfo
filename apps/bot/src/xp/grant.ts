import { Prisma } from '@prisma/client';
import type { XpRules, XpSegment, XpSource } from '@nx-stolfo/api-interfaces';
import type { Db } from '../db';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';
import { Interval, OtherPiece, Session, starterSessions, stayStarts, togetherMs, voiceXp } from './voice-xp';

/**
 * Grants XP into the ledger (xp_events). Every grant has a unique key, so running this again, for the
 * backfill, the hourly sweep or a live event, only adds what's missing. The amounts come from `rules`;
 * an amount of 0 turns that source off.
 */

type GrantDb = Pick<Db, '$queryRaw'>;

export interface GrantOptions {
  guildId: string;
  /** One member (the live path), or the whole guild */
  memberId?: string;
  /** Only XP earned from here on; undefined = all history */
  since?: Date;
  rules: XpRules;
  isBot: (id: string) => boolean;
  channelName?: (channelId: string) => string | undefined;
  now?: Date;
}

export interface Granted {
  rows: number;
  xp: number;
}

interface XpRow {
  memberId: string;
  source: XpSource;
  amount: number;
  note: string;
  key: string;
  at: Date;
  segments?: XpSegment[];
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Voice time a UTC day needs to count for a streak, like getStreaks */
const VOICE_DAY_MS = 10 * MINUTE;
/** Own rows loaded before the first session, to find where a stay began. shortcut: a stay over a day long restarts its count, raise if stayCap ever needs more */
const STAY_LOOKBACK_MS = DAY;
const CHUNK = 500;

const sum = (results: { rows: number; xp: number }[]): Granted =>
  results.reduce((a, b) => ({ rows: a.rows + b.rows, xp: a.xp + b.xp }), { rows: 0, xp: 0 });

/** `INSERT … ON CONFLICT DO NOTHING` wrapped so the count and XP of the rows actually added come back */
const counted = async (db: GrantDb, insert: Prisma.Sql): Promise<Granted> => {
  const [row] = await db.$queryRaw<{ rows: number; xp: number }[]>`
    WITH added AS (${insert} ON CONFLICT (key) DO NOTHING RETURNING amount)
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(amount), 0)::int AS xp FROM added
  `;
  return { rows: row?.rows ?? 0, xp: row?.xp ?? 0 };
};

const insertRows = async (db: GrantDb, guildId: string, rows: XpRow[]): Promise<Granted> => {
  const results: Granted[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows
      .slice(i, i + CHUNK)
      .map(
        (r) =>
          Prisma.sql`(gen_random_uuid()::text, ${guildId}, ${r.memberId}, ${r.source}, ${r.amount}, ${r.note}, ${
            r.segments ? JSON.stringify(r.segments) : null
          }::jsonb, ${r.key}, ${r.at}::timestamp)`
      );
    results.push(
      await counted(
        db,
        Prisma.sql`INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, segments, key, created_at) VALUES ${Prisma.join(values)}`
      )
    );
  }
  return sum(results);
};

const memberFilter = (column: string, memberId?: string) =>
  memberId ? Prisma.sql`AND ${Prisma.raw(column)} = ${memberId}` : Prisma.empty;
const notBots = (column: string, botIds: string[]) =>
  botIds.length ? Prisma.sql`AND ${Prisma.raw(column)} NOT IN (${Prisma.join(botIds)})` : Prisma.empty;
const sinceFilter = (column: string, since?: Date) =>
  since ? Prisma.sql`AND ${Prisma.raw(column)} >= ${since}` : Prisma.empty;

// ── Voice, starter, reconnect, welcome ──────────────────────────────────────

interface VoiceRow {
  id: string;
  member_id: string;
  channel_id: string;
  type: string;
  issued_on: Date;
  ended_on: Date;
}

/** `base` with the `cuts` taken out */
const subtract = (base: Interval, cuts: Interval[]) => {
  const out: Interval[] = [];
  let start = base.from;
  for (const cut of [...cuts].sort((a, b) => a.from - b.from)) {
    if (cut.to <= start || cut.from >= base.to) continue;
    if (cut.from > start) out.push({ from: start, to: cut.from });
    start = Math.max(start, cut.to);
  }
  if (start < base.to) out.push({ from: start, to: base.to });
  return out;
};

const interval = (row: VoiceRow) => ({ from: row.issued_on.getTime(), to: row.ended_on.getTime() });
const overlaps = (a: Interval, b: Interval) => a.from < b.to && b.from < a.to;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Pieces sorted by start, with the longest one, so the ones overlapping a span are found without a full scan */
const indexPieces = (pieces: OtherPiece[]) => {
  const sorted = [...pieces].sort((a, b) => a.from - b.from);
  const longest = Math.max(0, ...sorted.map((p) => p.to - p.from));
  return (span: Interval) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].from < span.from - longest) lo = mid + 1;
      else hi = mid;
    }
    const found: OtherPiece[] = [];
    for (let i = lo; i < sorted.length && sorted[i].from < span.to; i++) {
      if (overlaps(sorted[i], span)) found.push(sorted[i]);
    }
    return found;
  };
};

const grantVoice = async (db: GrantDb, opts: GrantOptions, botIds: string[]): Promise<Granted> => {
  const { guildId, memberId, since, rules } = opts;
  const { amounts, thresholds } = rules;

  // Closed sessions not graded yet
  const sessionRows = await db.$queryRaw<VoiceRow[]>`
    SELECT v.id, v.member_id, v.channel_id, v.type, v.issued_on, v.ended_on
    FROM voice_stats v
    WHERE v.guild_id = ${guildId} AND v.type = ${VOICE_TYPE.VOICE} AND v.ended_on IS NOT NULL
      ${memberFilter('v.member_id', memberId)}
      ${notBots('v.member_id', botIds)}
      ${sinceFilter('v.ended_on', since)}
      AND NOT EXISTS (SELECT 1 FROM xp_events x WHERE x.key = 'voice:' || v.id)
  `;
  if (!sessionRows.length) return { rows: 0, xp: 0 };
  const sessions: (Session & { memberId: string })[] = sessionRows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    channelId: r.channel_id,
    ...interval(r),
  }));
  const lo = new Date(Math.min(...sessions.map((s) => s.from)) - STAY_LOOKBACK_MS);
  const hi = new Date(Math.max(...sessions.map((s) => s.to)));
  const channels = [...new Set(sessions.map((s) => s.channelId))];

  // Everyone's VOICE and DEAF rows in those channels, and the members' own rows anywhere (camera,
  // screen share, and the sessions before for the stay)
  const context = await db.$queryRaw<VoiceRow[]>`
    SELECT id, member_id, channel_id, type, issued_on, COALESCE(ended_on, NOW()) AS ended_on
    FROM voice_stats
    WHERE guild_id = ${guildId}
      AND type IN (${Prisma.join([VOICE_TYPE.VOICE, VOICE_TYPE.DEAF, VOICE_TYPE.VIDEO, VOICE_TYPE.STREAMING])})
      AND issued_on < ${hi} AND COALESCE(ended_on, NOW()) > ${lo}
      ${memberId ? Prisma.sql`AND (channel_id IN (${Prisma.join(channels)}) OR member_id = ${memberId})` : Prisma.empty}
  `;
  const humans = context.filter((r) => !opts.isBot(r.member_id));
  const byMemberChannel = new Map<string, VoiceRow[]>();
  for (const row of humans) {
    const key = `${row.member_id}|${row.channel_id}`;
    byMemberChannel.set(key, [...(byMemberChannel.get(key) ?? []), row]);
  }
  const ofType = (rows: VoiceRow[] | undefined, type: VOICE_TYPE) => (rows ?? []).filter((r) => r.type === type).map(interval);

  // Others' time in each channel, deafened stretches cut out
  const piecesByChannel = new Map<string, OtherPiece[]>();
  for (const rows of byMemberChannel.values()) {
    const deaf = ofType(rows, VOICE_TYPE.DEAF);
    for (const row of rows.filter((r) => r.type === VOICE_TYPE.VOICE)) {
      const pieces = subtract(interval(row), deaf).map((p) => ({ ...p, memberId: row.member_id, sessionId: row.id }));
      piecesByChannel.set(row.channel_id, [...(piecesByChannel.get(row.channel_id) ?? []), ...pieces]);
    }
  }
  const findPieces = new Map([...piecesByChannel].map(([channel, pieces]) => [channel, indexPieces(pieces)]));

  const stay = new Map<string, number>();
  const ownSessions = new Map<string, Session[]>();
  for (const row of humans.filter((r) => r.type === VOICE_TYPE.VOICE)) {
    ownSessions.set(row.member_id, [...(ownSessions.get(row.member_id) ?? []), { id: row.id, channelId: row.channel_id, ...interval(row) }]);
  }
  for (const list of ownSessions.values()) stayStarts(list).forEach((start, id) => stay.set(id, start));

  // For welcome: each member's first session, and when tracking began on the server
  const [firsts, [{ first: trackedSince }]] = await Promise.all([
    db.$queryRaw<{ member_id: string; id: string; issued_on: Date }[]>`
      SELECT DISTINCT ON (member_id) member_id, id, issued_on
      FROM voice_stats
      WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
        ${memberId ? Prisma.sql`AND member_id IN (${Prisma.join([...new Set(humans.map((r) => r.member_id))])})` : Prisma.empty}
      ORDER BY member_id, issued_on
    `,
    db.$queryRaw<{ first: Date | null }[]>`SELECT MIN(issued_on) AS first FROM voice_stats WHERE guild_id = ${guildId}`,
  ]);
  const welcomeFrom = (trackedSince?.getTime() ?? Infinity) + thresholds.welcomeAfterDays * DAY;
  const newcomerSession = new Map(
    firsts.filter((f) => f.issued_on.getTime() >= welcomeFrom).map((f) => [f.member_id, f.id])
  );

  // Starter bonuses already granted on those days
  const taken = await db.$queryRaw<{ member_id: string; day: string; count: number }[]>`
    SELECT member_id, split_part(key, ':', 4) AS day, COUNT(*)::int AS count
    FROM xp_events
    WHERE guild_id = ${guildId} AND source = 'STARTER' AND created_at >= ${lo}
      ${memberFilter('member_id', memberId)}
    GROUP BY 1, 2
  `;

  const rows: XpRow[] = [];
  const together = thresholds.togetherMin * MINUTE;
  const pairs: { session: Session & { memberId: string }; other: string }[] = [];
  const bySessionMember = new Map<string, (Session & { memberId: string })[]>();
  sessions.forEach((s) => bySessionMember.set(s.memberId, [...(bySessionMember.get(s.memberId) ?? []), s]));

  for (const [member, list] of bySessionMember) {
    const graded: { session: Session; others: OtherPiece[] }[] = [];
    for (const session of list) {
      const others = (findPieces.get(session.channelId)?.(session) ?? []).filter((p) => p.memberId !== member);
      graded.push({ session, others });
      const own = byMemberChannel.get(`${member}|${session.channelId}`);
      const clip = (intervals: Interval[]) => intervals.filter((i) => overlaps(i, session));
      const voice = voiceXp(
        {
          session,
          ownDeaf: clip(ofType(own, VOICE_TYPE.DEAF)),
          ownVideo: clip(ofType(own, VOICE_TYPE.VIDEO)),
          ownStreaming: clip(ofType(own, VOICE_TYPE.STREAMING)),
          stayStart: stay.get(session.id) ?? session.from,
          others,
          channelName: opts.channelName?.(session.channelId),
        },
        rules
      );
      if (amounts.voiceMinute > 0) {
        rows.push({ memberId: member, source: 'VOICE', amount: voice.amount, note: voice.note, key: `voice:${session.id}`, at: new Date(session.to), segments: voice.segments });
      }

      const byOther = new Map<string, OtherPiece[]>();
      others.forEach((p) => byOther.set(p.memberId, [...(byOther.get(p.memberId) ?? []), p]));
      for (const [other, pieces] of byOther) {
        if (togetherMs(session, pieces) < together) continue;
        pairs.push({ session, other });
        const firstId = newcomerSession.get(other);
        const atFirst = pieces.filter((p) => p.sessionId === firstId);
        if (amounts.welcome > 0 && firstId && togetherMs(session, atFirst) >= together) {
          rows.push({
            memberId: member,
            source: 'WELCOME',
            amount: amounts.welcome,
            note: 'In the call for a newcomer’s first time in voice',
            key: `welcome:${guildId}:${other}:${member}`,
            at: new Date(session.to),
          });
        }
      }
    }

    if (amounts.starter > 0) {
      const takenDays = new Map(taken.filter((t) => t.member_id === member).map((t) => [t.day, t.count]));
      for (const { session, day, n } of starterSessions(graded, rules, takenDays)) {
        rows.push({
          memberId: member,
          source: 'STARTER',
          amount: amounts.starter,
          note: `Started the call in #${opts.channelName?.(session.channelId) ?? 'voice'}`,
          key: `starter:${guildId}:${member}:${day}:${n}`,
          at: new Date(session.to),
        });
      }
    }
  }

  if (amounts.reconnect > 0 && pairs.length) rows.push(...(await reconnects(db, guildId, pairs, rules)));
  return insertRows(db, guildId, rows);
};

/** Pairs back in a call after `reconnectDays` apart; a first call together isn't a reconnect */
const reconnects = async (
  db: GrantDb,
  guildId: string,
  pairs: { session: Session & { memberId: string }; other: string }[],
  rules: XpRules
): Promise<XpRow[]> => {
  const rows: XpRow[] = [];
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const batch = pairs.slice(i, i + CHUNK);
    const values = batch.map((p, j) => Prisma.sql`(${j}::int, ${p.session.memberId}, ${p.other}, ${new Date(p.session.from)}::timestamp)`);
    // The end of each pair's last time together before the session
    const lasts = await db.$queryRaw<{ i: number; last: Date }[]>`
      SELECT p.i, MAX(LEAST(a.ended_on, COALESCE(b.ended_on, NOW()))) AS last
      FROM (VALUES ${Prisma.join(values)}) AS p(i, member, other, before)
      JOIN voice_stats a
        ON a.guild_id = ${guildId} AND a.member_id = p.member AND a.type = ${VOICE_TYPE.VOICE} AND a.ended_on <= p.before
      JOIN voice_stats b
        ON b.guild_id = ${guildId} AND b.member_id = p.other AND b.type = ${VOICE_TYPE.VOICE}
       AND b.channel_id = a.channel_id
       AND b.issued_on < a.ended_on AND COALESCE(b.ended_on, NOW()) > a.issued_on
      GROUP BY p.i
    `;
    for (const { i: j, last } of lasts) {
      const { session, other } = batch[j];
      const days = Math.floor((session.from - last.getTime()) / DAY);
      if (days < rules.thresholds.reconnectDays) continue;
      rows.push({
        memberId: session.memberId,
        source: 'RECONNECT',
        amount: rules.amounts.reconnect,
        note: `Back in a call with someone after ${days} days`,
        key: `reconnect:${guildId}:${session.memberId}:${other}:${utcDay(session.from)}`,
        at: new Date(session.to),
      });
    }
  }
  return rows;
};

// ── Messages, streaks, games, milestones, weekly top 3 ──────────────────────

/** The first message per member per UTC minute */
const grantMessages = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions) =>
  counted(
    db,
    Prisma.sql`
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, user_id, 'MESSAGE', ${rules.amounts.message}, 'Sent a message',
        'msg:' || ${guildId} || ':' || user_id || ':' || to_char(DATE_TRUNC('minute', created_at), 'YYYY-MM-DD"T"HH24:MI'),
        MIN(created_at)
      FROM message_stats
      WHERE guild_id = ${guildId}
        ${memberFilter('user_id', memberId)}
        ${sinceFilter('created_at', since)}
      GROUP BY user_id, DATE_TRUNC('minute', created_at)`
  );

/** A UTC voice day (10+ min, a session counting for the day it started) whose day before also counted */
const grantStreaks = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions, botIds: string[]) =>
  counted(
    db,
    Prisma.sql`
      WITH days AS (
        SELECT member_id, issued_on::date AS day,
          LEAST(MAX(COALESCE(ended_on, NOW())), issued_on::date + 1) AS earned
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
          ${memberFilter('member_id', memberId)}
          ${notBots('member_id', botIds)}
        GROUP BY member_id, issued_on::date
        HAVING SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000) >= ${VOICE_DAY_MS}
      ),
      -- Gaps and islands, like getStreaks: consecutive days share day - row_number
      islands AS (
        SELECT member_id, day, earned, day - (ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY day))::int AS island
        FROM days
      ),
      runs AS (
        SELECT member_id, day, earned, ROW_NUMBER() OVER (PARTITION BY member_id, island ORDER BY day) AS n
        FROM islands
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, member_id, 'STREAK', ${rules.amounts.streakDay},
        'Voice streak: day ' || n, 'streak:' || ${guildId} || ':' || member_id || ':' || to_char(day, 'YYYY-MM-DD'), earned
      FROM runs
      WHERE n >= 2 ${sinceFilter('earned', since)}`
  );

/** Rock-paper-scissors wins against another member, more for a win streak (games against Astolfo don't count) */
const grantGames = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions) => {
  const { gameWin, gameStreakStep, gameStreakCap } = rules.amounts;
  return counted(
    db,
    Prisma.sql`
      WITH games AS (
        SELECT gp.user_id, gr.id AS game_id, gr.created_at, gp.result = ${SCORING.WIN} AS won,
          ROW_NUMBER() OVER (PARTITION BY gp.user_id ORDER BY gr.created_at, gr.id)
            - ROW_NUMBER() OVER (PARTITION BY gp.user_id, gp.result = ${SCORING.WIN} ORDER BY gr.created_at, gr.id) AS run
        FROM game_player gp
        JOIN game_result gr ON gr.id = gp.game_result_id
        WHERE gr.guild_id = ${guildId} AND gr.game_type_id = ${GAME_TYPES.ROCK_PAPER_SCISSORS}
          ${memberFilter('gp.user_id', memberId)}
      ),
      wins AS (
        SELECT user_id, game_id, created_at,
          ROW_NUMBER() OVER (PARTITION BY user_id, run ORDER BY created_at, game_id) AS in_a_row
        FROM games
        WHERE won
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, user_id, 'GAME',
        ${gameWin} + LEAST(${gameStreakCap}, ${gameStreakStep} * (in_a_row - 1))::int,
        'Won rock-paper-scissors' || CASE WHEN in_a_row > 1 THEN ' (' || in_a_row || ' in a row)' ELSE '' END,
        'game:' || game_id || ':' || user_id, created_at
      FROM wins
      WHERE TRUE ${sinceFilter('created_at', since)}`
  );
};

/** Each lifetime voice-hour milestone, dated when the running total crossed it */
const grantMilestones = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions, botIds: string[]) =>
  counted(
    db,
    Prisma.sql`
      WITH running AS (
        SELECT member_id, ended_on,
          SUM(EXTRACT(EPOCH FROM (ended_on - issued_on)) * 1000) OVER (PARTITION BY member_id ORDER BY ended_on, id) AS total
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} AND ended_on IS NOT NULL
          ${memberFilter('member_id', memberId)}
          ${notBots('member_id', botIds)}
      ),
      reached AS (
        SELECT r.member_id, h.hours,
          MIN(r.ended_on - make_interval(secs => (r.total - h.hours * 3600000.0) / 1000)) AS at
        FROM running r
        JOIN unnest(${rules.thresholds.milestoneHours}::int[]) AS h(hours) ON r.total >= h.hours * 3600000.0
        GROUP BY r.member_id, h.hours
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, member_id, 'MILESTONE', ${rules.amounts.milestone},
        'Reached ' || hours || ' hours in voice', 'milestone:' || ${guildId} || ':' || member_id || ':' || hours, at
      FROM reached
      WHERE TRUE ${sinceFilter('at', since)}`
  );

/** The top 3 by voice time in every finished Monday–Sunday UTC week, ranked like the digest's top voice */
const grantWeekly = (db: GrantDb, { guildId, since, rules, now = new Date() }: GrantOptions, botIds: string[]) => {
  const [first, second, third] = rules.amounts.weekly;
  return counted(
    db,
    Prisma.sql`
      WITH weeks AS (
        SELECT DATE_TRUNC('week', issued_on) AS week, member_id,
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, NOW()) - issued_on)) * 1000) AS total
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE}
          AND issued_on < DATE_TRUNC('week', ${now}::timestamp)
          ${since ? Prisma.sql`AND issued_on >= DATE_TRUNC('week', ${since}::timestamp) - INTERVAL '7 days'` : Prisma.empty}
          ${notBots('member_id', botIds)}
        GROUP BY 1, 2
      ),
      ranked AS (
        SELECT week, member_id, ROW_NUMBER() OVER (PARTITION BY week ORDER BY total DESC, member_id)::int AS place
        FROM weeks
      ),
      amounts AS (
        SELECT week, member_id, place, (ARRAY[${first}::int, ${second}::int, ${third}::int])[place] AS amount
        FROM ranked WHERE place <= 3
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, member_id, 'WEEKLY', amount,
        CASE place WHEN 1 THEN 'Most' WHEN 2 THEN 'Second most' ELSE 'Third most' END
          || ' voice time in the week of ' || to_char(week, 'YYYY-MM-DD'),
        'weekly:' || ${guildId} || ':' || to_char(week, 'YYYY-MM-DD') || ':' || member_id, week + INTERVAL '7 days'
      FROM amounts
      WHERE amount > 0`
  );
};

/**
 * Grants every source for one member (live) or the whole guild (the sweep, the backfill and a
 * recalculation). The weekly top 3 is whole-guild only. Returns the rows and XP added.
 */
export const grantXp = async (db: GrantDb, opts: GrantOptions): Promise<Granted> => {
  const { guildId, memberId, rules, isBot } = opts;
  if (memberId && isBot(memberId)) return { rows: 0, xp: 0 };
  // Bots are only in voice; the ids are needed to keep them out of the SQL-side grants
  const botIds = memberId
    ? []
    : (
        await db.$queryRaw<{ member_id: string }[]>`SELECT DISTINCT member_id FROM voice_stats WHERE guild_id = ${guildId}`
      )
        .map((r) => r.member_id)
        .filter(isBot);

  const { amounts, thresholds } = rules;
  const results: Granted[] = [];
  // One at a time: the grants are independent, but a backfill shouldn't take every pool connection
  results.push(await grantVoice(db, opts, botIds));
  if (amounts.message > 0) results.push(await grantMessages(db, opts));
  if (amounts.streakDay > 0) results.push(await grantStreaks(db, opts, botIds));
  if (amounts.gameWin > 0) results.push(await grantGames(db, opts));
  if (amounts.milestone > 0 && thresholds.milestoneHours.length) results.push(await grantMilestones(db, opts, botIds));
  if (!memberId && amounts.weekly.some((a) => a > 0)) results.push(await grantWeekly(db, opts, botIds));
  return sum(results);
};

/** XP total of a member on a server */
export const totalXp = async (db: GrantDb, guildId: string, memberId: string) => {
  const [row] = await db.$queryRaw<{ xp: number }[]>`
    SELECT COALESCE(SUM(amount), 0)::int AS xp FROM xp_events WHERE guild_id = ${guildId} AND member_id = ${memberId}
  `;
  return row?.xp ?? 0;
};
