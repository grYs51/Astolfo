/**
 * Seeds the local DB with ~4 months of realistic voice activity for the
 * MOCK_DISCORD fixture servers, so every dashboard feature has data:
 * heatmaps, timeline, leaderboard, channels, activity breakdown, user
 * profiles and a few people "in voice right now".
 *
 *   yarn nx run bot:seed        (then serve the bot with MOCK_DISCORD=true)
 *
 * Re-runnable: it only deletes and recreates rows of the mock guild ids.
 * Deterministic: the same seed produces the same activity patterns.
 */
import { randomUUID } from 'crypto';
import { PrismaClient, voice_stats } from '@prisma/client';
import { MOCK_GUILDS, MOCK_USER, MockGuild } from './mock-discord';
import { VOICE_TYPE } from '../utils/handlers/vc/voice-utils';
import { Logger } from '../utils/logger';

const DAYS = 120;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// mulberry32 — tiny deterministic PRNG
let state = 0x5eed;
const random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min: number, max: number) => min + random() * (max - min);
const chance = (p: number) => random() < p;
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

/**
 * Hours are UTC. The dashboard converts to the viewer's zone, so e.g. 18 UTC
 * shows as 20:00 for a Brussels viewer.
 */
type Persona = {
  /** Chance of a session on a weekday / weekend day */
  weekday: number;
  weekend: number;
  hours: number[];
  minutes: [number, number];
  /** Preferred channel names (falls back to any channel of the guild) */
  channels: string[];
  deafen: number;
  stream: number;
  video: number;
};

const personas: Record<string, Persona> = {
  regular: { weekday: 0.55, weekend: 0.6, hours: [17, 18, 19, 20], minutes: [45, 180], channels: ['Lobby', 'Gaming'], deafen: 0.1, stream: 0.15, video: 0.05 },
  nightOwl: { weekday: 0.6, weekend: 0.7, hours: [21, 22, 23, 0, 1], minutes: [90, 300], channels: ['Late Night', 'Raid Night', 'Gaming'], deafen: 0.1, stream: 0.3, video: 0.02 },
  weekend: { weekday: 0.08, weekend: 0.85, hours: [11, 13, 15, 17, 19], minutes: [120, 360], channels: ['Gaming', 'Raid Night', 'Friday Stage'], deafen: 0.05, stream: 0.25, video: 0.05 },
  student: { weekday: 0.5, weekend: 0.15, hours: [12, 13, 14, 15], minutes: [45, 150], channels: ['Study Room'], deafen: 0.05, stream: 0.05, video: 0.25 },
  lurker: { weekday: 0.15, weekend: 0.2, hours: [14, 16, 18, 20], minutes: [60, 300], channels: ['AFK', 'Music', 'Lobby'], deafen: 0.75, stream: 0, video: 0 },
  music: { weekday: 0.35, weekend: 0.4, hours: [16, 18, 20], minutes: [30, 120], channels: ['Music', 'Lobby'], deafen: 0.05, stream: 0.1, video: 0 },
};

const personaOf: Record<string, Persona> = {
  [MOCK_USER.id]: personas.regular,
  '200000000000000101': personas.regular, // Luna
  '200000000000000102': personas.regular, // Kai
  '200000000000000103': personas.student, // Mira
  '200000000000000104': personas.student, // Theo
  '200000000000000105': personas.music, // Nova
  '200000000000000106': personas.nightOwl, // Rex
  '200000000000000107': personas.weekend, // Ivy
  '200000000000000108': personas.lurker, // Otto
  '200000000000000109': personas.music, // Sage
  '200000000000000110': personas.nightOwl, // Finn
  '200000000000000111': personas.weekend, // Zoe
  '200000000000000112': personas.lurker, // Milo
};

/** Members shown as currently in voice (open sessions) */
const inVoiceNow = new Set([
  MOCK_USER.id,
  '200000000000000101', // Luna
  '200000000000000106', // Rex
  '200000000000000108', // Otto
]);

const row = (
  guild: MockGuild,
  channelId: string,
  memberId: string,
  start: number,
  end: number | null,
  type: VOICE_TYPE
): voice_stats => ({
  id: randomUUID(),
  guild_id: guild.id,
  channel_id: channelId,
  member_id: memberId,
  issued_on: new Date(start),
  ended_on: end === null ? null : new Date(end),
  type,
});

/** A sub-interval of [start, end] covering roughly `fraction` of it */
const slice = (start: number, end: number, fraction: [number, number]) => {
  const length = (end - start) * between(...fraction);
  const from = start + random() * (end - start - length);
  return [from, from + length] as const;
};

/** One session: a VOICE row plus the state rows that happen inside it */
const session = (
  guild: MockGuild,
  memberId: string,
  persona: Persona,
  start: number,
  end: number | null,
  now: number
): voice_stats[] => {
  const preferred = guild.channels.filter((c) => persona.channels.includes(c.name));
  const channel = pick(preferred.length > 0 ? preferred : guild.channels);
  const until = end ?? now;
  const rows = [row(guild, channel.id, memberId, start, end, VOICE_TYPE.VOICE)];

  // Deafening also mutes: the bot writes both rows for the same interval
  if (chance(persona.deafen)) {
    const openState = end === null && chance(0.5);
    const [from, to] = openState
      ? [start + (until - start) * between(0.2, 0.6), until]
      : slice(start, until, [0.3, 0.9]);
    const closedAt = openState ? null : to;
    rows.push(row(guild, channel.id, memberId, from, closedAt, VOICE_TYPE.DEAF));
    rows.push(row(guild, channel.id, memberId, from, closedAt, VOICE_TYPE.MUTED));
  } else {
    for (let i = Math.floor(between(0, 3)); i > 0; i--) {
      const [from, to] = slice(start, until, [0.03, 0.15]);
      rows.push(row(guild, channel.id, memberId, from, to, VOICE_TYPE.MUTED));
    }
  }
  if (chance(persona.stream)) {
    const [from, to] = slice(start, until, [0.2, 0.8]);
    rows.push(row(guild, channel.id, memberId, from, to, VOICE_TYPE.STREAMING));
  }
  if (chance(persona.video)) {
    const [from, to] = slice(start, until, [0.1, 0.5]);
    rows.push(row(guild, channel.id, memberId, from, to, VOICE_TYPE.VIDEO));
  }
  if (chance(0.02)) {
    const [from, to] = slice(start, until, [0.05, 0.2]);
    rows.push(row(guild, channel.id, memberId, from, to, VOICE_TYPE.SERVER_MUTED));
  }
  return rows;
};

const generate = (now: number): voice_stats[] => {
  const rows: voice_stats[] = [];
  const today = Math.floor(now / DAY) * DAY;
  const memberIds = [...new Set(MOCK_GUILDS.flatMap((g) => g.members.map((m) => m.id)))];

  for (const memberId of memberIds) {
    const persona = personaOf[memberId] ?? personas.regular;
    const guilds = MOCK_GUILDS.filter((g) => g.members.some((m) => m.id === memberId));
    // Past sessions end at least this long ago, so they never overlap the
    // open "in voice now" session
    const historyEnd = inVoiceNow.has(memberId) ? now - 3 * HOUR : now - 10 * MINUTE;
    let busyUntil = 0; // one person can only be in one channel at a time

    for (let day = today - DAYS * DAY; day <= today; day += DAY) {
      const weekday = new Date(day).getUTCDay();
      const isWeekend = weekday === 0 || weekday === 6;
      // A slow ramp-up so the timeline shows the server growing
      const growth = 0.55 + 0.45 * ((day - (today - DAYS * DAY)) / (DAYS * DAY));
      const sessions = chance((isWeekend ? persona.weekend : persona.weekday) * growth)
        ? chance(0.25) ? 2 : 1
        : 0;

      for (let i = 0; i < sessions; i++) {
        const start = Math.max(
          day + pick(persona.hours) * HOUR + between(0, 59) * MINUTE + i * 4 * HOUR,
          busyUntil + 15 * MINUTE
        );
        const end = start + between(...persona.minutes) * MINUTE;
        if (end > historyEnd) continue;
        rows.push(...session(pick(guilds), memberId, persona, start, end, now));
        busyUntil = end;
      }
    }

    if (inVoiceNow.has(memberId)) {
      const start = now - between(20, 110) * MINUTE;
      rows.push(...session(guilds[0], memberId, persona, start, null, now));
    }
  }
  return rows;
};

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed mock data with NODE_ENV=production');
  }

  const db = new PrismaClient();
  try {
    const guildIds = MOCK_GUILDS.map((g) => g.id);
    const rows = generate(Date.now());

    const { count: removed } = await db.voice_stats.deleteMany({
      where: { guild_id: { in: guildIds } },
    });
    for (let i = 0; i < rows.length; i += 1000) {
      await db.voice_stats.createMany({ data: rows.slice(i, i + 1000) });
    }

    const open = rows.filter((r) => r.ended_on === null && r.type === VOICE_TYPE.VOICE);
    Logger.info(
      `Seeded ${rows.length} voice_stats rows for ${MOCK_GUILDS.map((g) => g.name).join(' + ')} ` +
        `(${DAYS} days, ${open.length} people in voice now; replaced ${removed} old mock rows).`
    );
    Logger.info('Serve the bot with MOCK_DISCORD=true and log in on the dashboard as the mock user.');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  Logger.error('Seeding failed', error);
  process.exit(1);
});
