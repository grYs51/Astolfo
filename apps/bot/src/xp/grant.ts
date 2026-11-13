import { Prisma } from '@prisma/client';
import type { XpRules, XpSegment, XpSource } from '@nx-stolfo/api-interfaces';
import type { Db } from '../db';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';
import { GAME_TYPES, SCORING } from '../utils/handlers/games-handler';
import { GEO_CATEGORY } from '../geo/types';
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
  /** Only these sources (the live path: a message can only earn message XP); undefined = all */
  sources?: XpSource[];
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

const insertXp = (guildId: string, rows: XpRow[]) =>
  Prisma.sql`INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, segments, key, created_at) VALUES ${Prisma.join(
    rows.map(
      (r) =>
        Prisma.sql`(gen_random_uuid()::text, ${guildId}, ${r.memberId}, ${r.source}, ${r.amount}, ${r.note}, ${
          r.segments ? JSON.stringify(r.segments) : null
        }::jsonb, ${r.key}, ${r.at}::timestamp)`
    )
  )}`;

/**
 * VOICE rows are graded again while their session is open (checkpoints) and once more when it closes, so
 * they replace the row in place. The XP added is the new amount minus the old: every CTE reads the same
 * snapshot, so `old` holds the amounts from before the upsert. An unchanged row isn't rewritten or counted.
 */
const upserted = async (db: GrantDb, guildId: string, rows: XpRow[]): Promise<Granted> => {
  const [row] = await db.$queryRaw<{ rows: number; xp: number }[]>`
    WITH old AS (SELECT key, amount FROM xp_events WHERE key IN (${Prisma.join(rows.map((r) => r.key))})),
    added AS (
      ${insertXp(guildId, rows)}
      ON CONFLICT (key) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, segments = EXCLUDED.segments,
        created_at = EXCLUDED.created_at
      WHERE (xp_events.amount, xp_events.note, xp_events.segments, xp_events.created_at)
        IS DISTINCT FROM (EXCLUDED.amount, EXCLUDED.note, EXCLUDED.segments, EXCLUDED.created_at)
      RETURNING key, amount
    )
    SELECT COUNT(*)::int AS rows, COALESCE(SUM(a.amount - COALESCE(o.amount, 0)), 0)::int AS xp
    FROM added a LEFT JOIN old o USING (key)
  `;
  return { rows: row?.rows ?? 0, xp: row?.xp ?? 0 };
};

const insertRows = async (db: GrantDb, guildId: string, rows: XpRow[]): Promise<Granted> => {
  const results: Granted[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    // Sorted by key, so two statements upserting the same rows lock them in the same order and can't deadlock
    const chunk = rows.slice(i, i + CHUNK).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const voice = chunk.filter((r) => r.source === 'VOICE');
    const rest = chunk.filter((r) => r.source !== 'VOICE');
    if (voice.length) results.push(await upserted(db, guildId, voice));
    if (rest.length) results.push(await counted(db, insertXp(guildId, rest)));
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
  /** Still in the call: ended_on is `now` */
  open?: boolean;
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

/** Append to a list in a map; copying the list on every append would be quadratic on a backfill */
const append = <K, V>(map: Map<K, V[]>, key: K, ...values: V[]) => {
  const list = map.get(key);
  if (list) list.push(...values);
  else map.set(key, values);
};

const interval = (row: VoiceRow) => ({ from: row.issued_on.getTime(), to: row.ended_on.getTime() });
const overlaps = (a: Interval, b: Interval) => a.from < b.to && b.from < a.to;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Pieces sorted by start, with the longest one, so the ones overlapping a span are found without a full scan */
const indexPieces = (pieces: OtherPiece[]) => {
  const sorted = [...pieces].sort((a, b) => a.from - b.from);
  const longest = sorted.reduce((max, p) => Math.max(max, p.to - p.from), 0);
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
  const { guildId, memberId, since, rules, now = new Date() } = opts;
  const { amounts, thresholds } = rules;

  // Open sessions (graded up to now: a checkpoint) and closed ones not graded to their end yet. A final
  // voice row is dated at the session's end, a checkpoint at the checkpoint. Only a member's own run grades
  // open sessions: it runs in their voice queue with the close, while a sweep that read a session as open
  // could land after the close and overwrite the final row.
  const sessionRows = await db.$queryRaw<VoiceRow[]>`
    SELECT v.id, v.member_id, v.channel_id, v.type, v.issued_on, COALESCE(v.ended_on, ${now}::timestamp) AS ended_on,
      v.ended_on IS NULL AS open
    FROM voice_stats v
    LEFT JOIN xp_events x ON x.key = 'voice:' || v.id
    WHERE v.guild_id = ${guildId} AND v.type = ${VOICE_TYPE.VOICE} AND v.issued_on < ${now}::timestamp
      AND ${memberId ? Prisma.sql`(v.ended_on IS NULL OR` : Prisma.sql`(v.ended_on IS NOT NULL AND`}
        x.created_at IS DISTINCT FROM v.ended_on)
      ${memberFilter('v.member_id', memberId)}
      ${notBots('v.member_id', botIds)}
      ${since ? Prisma.sql`AND (v.ended_on IS NULL OR v.ended_on >= ${since})` : Prisma.empty}
  `;
  if (!sessionRows.length) return { rows: 0, xp: 0 };
  const sessions: (Session & { memberId: string; open: boolean })[] = sessionRows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    channelId: r.channel_id,
    open: !!r.open,
    ...interval(r),
  }));
  // A loop, not Math.min(...list): spreading 100k+ sessions overflows the stack
  const lo = new Date(sessions.reduce((min, s) => Math.min(min, s.from), Infinity) - STAY_LOOKBACK_MS);
  const hi = new Date(sessions.reduce((max, s) => Math.max(max, s.to), -Infinity));
  const channels = [...new Set(sessions.map((s) => s.channelId))];

  // Everyone's VOICE and DEAF rows in those channels, and the members' own rows anywhere (camera,
  // screen share, and the sessions before for the stay)
  const context = await db.$queryRaw<VoiceRow[]>`
    SELECT id, member_id, channel_id, type, issued_on, COALESCE(ended_on, ${now}::timestamp) AS ended_on
    FROM voice_stats
    WHERE guild_id = ${guildId}
      AND type IN (${Prisma.join([VOICE_TYPE.VOICE, VOICE_TYPE.DEAF, VOICE_TYPE.VIDEO, VOICE_TYPE.STREAMING])})
      AND issued_on < ${hi} AND COALESCE(ended_on, ${now}::timestamp) > ${lo}
      ${memberId ? Prisma.sql`AND (channel_id IN (${Prisma.join(channels)}) OR member_id = ${memberId})` : Prisma.empty}
  `;
  const humans = context.filter((r) => !opts.isBot(r.member_id));
  const byMemberChannel = new Map<string, VoiceRow[]>();
  for (const row of humans) append(byMemberChannel, `${row.member_id}|${row.channel_id}`, row);
  const ofType = (rows: VoiceRow[] | undefined, type: VOICE_TYPE) => (rows ?? []).filter((r) => r.type === type).map(interval);

  // Others' time in each channel, deafened stretches cut out, and whole (for who was already there)
  const piecesByChannel = new Map<string, OtherPiece[]>();
  const presentByChannel = new Map<string, OtherPiece[]>();
  for (const rows of byMemberChannel.values()) {
    const deaf = ofType(rows, VOICE_TYPE.DEAF);
    for (const row of rows.filter((r) => r.type === VOICE_TYPE.VOICE)) {
      const pieces = subtract(interval(row), deaf).map((p) => ({ ...p, memberId: row.member_id, sessionId: row.id }));
      append(piecesByChannel, row.channel_id, ...pieces);
      append(presentByChannel, row.channel_id, { ...interval(row), memberId: row.member_id, sessionId: row.id });
    }
  }
  const findPieces = new Map([...piecesByChannel].map(([channel, pieces]) => [channel, indexPieces(pieces)]));
  const findPresent = new Map([...presentByChannel].map(([channel, pieces]) => [channel, indexPieces(pieces)]));

  const stay = new Map<string, number>();
  const ownSessions = new Map<string, Session[]>();
  for (const row of humans.filter((r) => r.type === VOICE_TYPE.VOICE)) {
    append(ownSessions, row.member_id, { id: row.id, channelId: row.channel_id, ...interval(row) });
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

  // Starter bonuses already granted on those days (the day the session started), for the daily cap
  const started = await db.$queryRaw<{ member_id: string; session_id: string; day: string }[]>`
    SELECT x.member_id, v.id AS session_id, to_char(v.issued_on, 'YYYY-MM-DD') AS day
    FROM xp_events x
    -- 9: the session id after 'starter:'
    JOIN voice_stats v ON v.id = substr(x.key, 9)
    WHERE x.guild_id = ${guildId} AND x.source = 'STARTER' AND x.created_at >= ${lo}
      ${memberFilter('x.member_id', memberId)}
  `;
  const startedIds = new Set(started.map((s) => s.session_id));

  const rows: XpRow[] = [];
  const together = thresholds.togetherMin * MINUTE;
  const pairs: { session: Session & { memberId: string }; other: string }[] = [];
  const bySessionMember = new Map<string, (Session & { memberId: string; open: boolean })[]>();
  sessions.forEach((s) => append(bySessionMember, s.memberId, s));

  for (const [member, list] of bySessionMember) {
    const graded: { session: Session; others: OtherPiece[]; present: OtherPiece[] }[] = [];
    for (const session of list) {
      const others = (findPieces.get(session.channelId)?.(session) ?? []).filter((p) => p.memberId !== member);
      const present = (findPresent.get(session.channelId)?.(session) ?? []).filter((p) => p.memberId !== member);
      graded.push({ session, others, present });
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
          open: session.open,
        },
        rules
      );
      if (amounts.voiceMinute > 0) {
        rows.push({ memberId: member, source: 'VOICE', amount: voice.amount, note: voice.note, key: `voice:${session.id}`, at: new Date(session.to), segments: voice.segments });
      }

      const byOther = new Map<string, OtherPiece[]>();
      others.forEach((p) => append(byOther, p.memberId, p));
      for (const [other, pieces] of byOther) {
        if (togetherMs(session, pieces) < together) continue;
        // Reconnect waits for the close: its query loads both members' whole voice history, too much for every checkpoint
        if (!session.open) pairs.push({ session, other });
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
      const takenDays = new Map<string, number>();
      started.filter((s) => s.member_id === member).forEach((s) => takenDays.set(s.day, (takenDays.get(s.day) ?? 0) + 1));
      // With the voice amount at 0 no voice: row marks a session as graded, so it comes round again; it keeps its one bonus
      const candidates = graded.filter((g) => !startedIds.has(g.session.id));
      for (const { session } of starterSessions(candidates, rules, takenDays)) {
        rows.push({
          memberId: member,
          source: 'STARTER',
          amount: amounts.starter,
          note: `Started the call in #${opts.channelName?.(session.channelId) ?? 'voice'}`,
          key: `starter:${session.id}`,
          at: new Date(session.to),
        });
      }
    }
  }

  if (amounts.reconnect > 0 && pairs.length) rows.push(...(await reconnects(db, guildId, pairs, rules)));
  return insertRows(db, guildId, rows);
};

/**
 * Pairs back in a call after `reconnectDays` apart; a first call together isn't a reconnect. The pairs'
 * voice history is swept once per channel in memory: a SQL self-join per pair grew with the cube of
 * their sessions on a backfill.
 */
const reconnects = async (
  db: GrantDb,
  guildId: string,
  pairs: { session: Session & { memberId: string }; other: string }[],
  rules: XpRules
): Promise<XpRow[]> => {
  const members = [...new Set(pairs.flatMap((p) => [p.session.memberId, p.other]))];
  const before = new Date(pairs.reduce((max, p) => Math.max(max, p.session.from), -Infinity));
  const history = await db.$queryRaw<VoiceRow[]>`
    SELECT id, member_id, channel_id, type, issued_on, COALESCE(ended_on, NOW()) AS ended_on
    FROM voice_stats
    WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} AND issued_on < ${before}
      AND member_id IN (${Prisma.join(members)})
  `;

  // When each pair's times together ended, oldest first
  const byChannel = new Map<string, VoiceRow[]>();
  history.forEach((row) => append(byChannel, row.channel_id, row));
  const ends = new Map<string, number[]>();
  for (const rows of byChannel.values()) {
    rows.sort((a, b) => a.issued_on.getTime() - b.issued_on.getTime());
    let open: VoiceRow[] = [];
    for (const row of rows) {
      open = open.filter((o) => o.ended_on > row.issued_on);
      for (const o of open) {
        if (o.member_id === row.member_id) continue;
        const end = Math.min(o.ended_on.getTime(), row.ended_on.getTime());
        append(ends, `${o.member_id}|${row.member_id}`, end);
        append(ends, `${row.member_id}|${o.member_id}`, end);
      }
      open.push(row);
    }
  }
  ends.forEach((list) => list.sort((a, b) => a - b));

  const rows: XpRow[] = [];
  for (const { session, other } of pairs) {
    // The last time together that had ended when this session started
    const list = ends.get(`${session.memberId}|${other}`) ?? [];
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] <= session.from) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) continue;
    const days = Math.floor((session.from - list[lo - 1]) / DAY);
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

/** Rock-paper-scissors and tic-tac-toe wins against another member, more for a win streak across both (games against Astolfo don't count) */
const grantGames = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions) => {
  const { gameWin, gameStreakStep, gameStreakCap } = rules.amounts;
  return counted(
    db,
    Prisma.sql`
      WITH games AS (
        SELECT gp.user_id, gr.id AS game_id, gr.game_type_id, gr.created_at, gp.result = ${SCORING.WIN} AS won,
          ROW_NUMBER() OVER (PARTITION BY gp.user_id ORDER BY gr.created_at, gr.id)
            - ROW_NUMBER() OVER (PARTITION BY gp.user_id, gp.result = ${SCORING.WIN} ORDER BY gr.created_at, gr.id) AS run
        FROM game_player gp
        JOIN game_result gr ON gr.id = gp.game_result_id
        WHERE gr.guild_id = ${guildId}
          AND gr.game_type_id IN (${GAME_TYPES.ROCK_PAPER_SCISSORS}, ${GAME_TYPES.TIC_TAC_TOE})
          ${memberFilter('gp.user_id', memberId)}
      ),
      wins AS (
        SELECT user_id, game_id, game_type_id, created_at,
          ROW_NUMBER() OVER (PARTITION BY user_id, run ORDER BY created_at, game_id) AS in_a_row
        FROM games
        WHERE won
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, user_id, 'GAME',
        ${gameWin} + LEAST(${gameStreakCap}, ${gameStreakStep} * (in_a_row - 1))::int,
        CASE game_type_id WHEN ${GAME_TYPES.TIC_TAC_TOE} THEN 'Won tic-tac-toe' ELSE 'Won rock-paper-scissors' END
          || CASE WHEN in_a_row > 1 THEN ' (' || in_a_row || ' in a row)' ELSE '' END,
        'game:' || game_id || ':' || user_id, created_at
      FROM wins
      WHERE TRUE ${sinceFilter('created_at', since)}`
  );
};

/**
 * Correct trivia answers: the first four by place, then a flat amount, times the question's difficulty.
 * A GeoGuess near miss (saved as a tie) earns its own flat amount, not times the difficulty: hard puts two
 * neighbours among the answers, so with the factor a random click there would pay off three times in four.
 * A member's trivia XP stops at the daily cap (UTC day): the grant that crosses it is cut to what's left.
 */
const grantTrivia = (db: GrantDb, { guildId, memberId, since, rules }: GrantOptions) => {
  const { trivia: places, triviaCorrect, triviaNear } = rules.amounts;
  const { easy, medium, hard } = rules.trivia;
  // The cap only needs the answers of the same UTC day as `since`; without `since` (a backfill) read them all
  const dayStart = since && new Date(Math.floor(since.getTime() / DAY) * DAY);
  return counted(
    db,
    Prisma.sql`
      WITH answers AS (
        SELECT gp.user_id, gr.id AS game_id, gr.created_at, gp.result,
          CASE WHEN gr.metadata->>'category' = ${GEO_CATEGORY} THEN 'GeoGuess' ELSE 'Trivia' END AS label,
          (SELECT o.n FROM jsonb_array_elements_text(gr.metadata->'correctOrder') WITH ORDINALITY AS o(id, n)
           WHERE o.id = gp.user_id)::int AS place,
          CASE gr.metadata->>'difficulty' WHEN 'hard' THEN ${hard}::numeric WHEN 'medium' THEN ${medium}::numeric
            ELSE ${easy}::numeric END AS factor,
          COALESCE(gr.metadata->>'difficulty', 'easy') AS difficulty
        FROM game_player gp
        JOIN game_result gr ON gr.id = gp.game_result_id
        WHERE gr.guild_id = ${guildId} AND gr.game_type_id = ${GAME_TYPES.TRIVIA}
          AND gp.result IN (${SCORING.WIN}, ${SCORING.TIE})
          ${memberFilter('gp.user_id', memberId)}
          ${sinceFilter('gr.created_at', dayStart)}
      ),
      scored AS (
        SELECT *,
          CASE WHEN result = ${SCORING.TIE} THEN ${triviaNear}::int
            ELSE ROUND(CASE WHEN place <= 4 THEN (${places}::int[])[place] ELSE ${triviaCorrect} END * factor)::int
          END AS full_amount
        FROM answers
        WHERE place IS NOT NULL OR result = ${SCORING.TIE}
      ),
      capped AS (
        SELECT *,
          LEAST(full_amount, GREATEST(0, ${rules.thresholds.triviaDailyCap} - COALESCE(SUM(full_amount) OVER (
            PARTITION BY user_id, created_at::date ORDER BY created_at, game_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)))::int AS amount
        FROM scored
      )
      INSERT INTO xp_events (id, guild_id, member_id, source, amount, note, key, created_at)
      SELECT gen_random_uuid()::text, ${guildId}, user_id, 'TRIVIA', amount,
        label || ': ' || CASE WHEN result = ${SCORING.TIE} THEN 'near miss' ELSE place
          || CASE WHEN place % 100 IN (11, 12, 13) THEN 'th' WHEN place % 10 = 1 THEN 'st'
          WHEN place % 10 = 2 THEN 'nd' WHEN place % 10 = 3 THEN 'rd' ELSE 'th' END
          || ' (' || difficulty || ' ×' || trim_scale(factor) || ')' END
          || CASE WHEN amount < full_amount THEN ', daily cap reached' ELSE '' END,
        'trivia:' || game_id || ':' || user_id, created_at
      FROM capped
      WHERE amount > 0 ${sinceFilter('created_at', since)}`
  );
};

/** Each lifetime voice-hour milestone, dated when the running total crossed it */
const grantMilestones = (db: GrantDb, { guildId, memberId, since, rules, now = new Date() }: GrantOptions, botIds: string[]) =>
  counted(
    db,
    Prisma.sql`
      WITH running AS (
        SELECT member_id, COALESCE(ended_on, ${now}::timestamp) AS ended_on,
          SUM(EXTRACT(EPOCH FROM (COALESCE(ended_on, ${now}::timestamp) - issued_on)) * 1000)
            OVER (PARTITION BY member_id ORDER BY COALESCE(ended_on, ${now}::timestamp), id) AS total
        FROM voice_stats
        WHERE guild_id = ${guildId} AND type = ${VOICE_TYPE.VOICE} AND issued_on < ${now}::timestamp
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
      -- Bots keep their place, so the names match the digest's, but earn nothing
      WHERE amount > 0 ${notBots('member_id', botIds)}`
  );
};

/**
 * Grants every source for one member (live) or the whole guild (the sweep, the backfill and a
 * recalculation). The weekly top 3 is whole-guild only. Returns the rows and XP added.
 */
export const grantXp = async (db: GrantDb, opts: GrantOptions): Promise<Granted> => {
  const { guildId, memberId, rules, isBot, sources } = opts;
  if (memberId && isBot(memberId)) return { rows: 0, xp: 0 };
  const wants = (...source: XpSource[]) => !sources || source.some((s) => sources.includes(s));
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
  if (wants('VOICE', 'STARTER', 'RECONNECT', 'WELCOME')) results.push(await grantVoice(db, opts, botIds));
  if (wants('MESSAGE') && amounts.message > 0) results.push(await grantMessages(db, opts));
  if (wants('STREAK') && amounts.streakDay > 0) results.push(await grantStreaks(db, opts, botIds));
  if (wants('GAME') && amounts.gameWin > 0) results.push(await grantGames(db, opts));
  if (wants('TRIVIA') && (amounts.trivia.some((a) => a > 0) || amounts.triviaCorrect > 0 || amounts.triviaNear > 0)) {
    results.push(await grantTrivia(db, opts));
  }
  if (wants('MILESTONE') && amounts.milestone > 0 && thresholds.milestoneHours.length) {
    results.push(await grantMilestones(db, opts, botIds));
  }
  if (wants('WEEKLY') && !memberId && amounts.weekly.some((a) => a > 0)) results.push(await grantWeekly(db, opts, botIds));
  return sum(results);
};

/** XP total of every member on a server */
export const guildTotals = async (db: GrantDb, guildId: string) => {
  const rows = await db.$queryRaw<{ member_id: string; xp: number }[]>`
    SELECT member_id, SUM(amount)::int AS xp FROM xp_events WHERE guild_id = ${guildId} GROUP BY member_id
  `;
  return new Map(rows.map((r) => [r.member_id, r.xp]));
};

/** XP total of a member on a server */
export const totalXp = async (db: GrantDb, guildId: string, memberId: string) => {
  const [row] = await db.$queryRaw<{ xp: number }[]>`
    SELECT COALESCE(SUM(amount), 0)::int AS xp FROM xp_events WHERE guild_id = ${guildId} AND member_id = ${memberId}
  `;
  return row?.xp ?? 0;
};
