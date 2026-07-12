/**
 * Seed realistic demo voice_stats data for a guild so the dashboard has
 * something to show during development.
 *
 * Usage:
 *   node tools/seed-voice-stats.cjs --guild <guildId> [--days 42] [--members id1,id2]
 *   node tools/seed-voice-stats.cjs --undo          # deletes everything a previous run inserted
 *
 * Members/channels default to the distinct ids already present in voice_stats
 * for that guild, so leaderboard/channel names resolve to real Discord entities.
 * All inserted row ids are recorded in tools/.seed-voice-stats-ids.json so the
 * run can be undone.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env (DATABASE_URL) without requiring dotenv
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IDS_FILE = path.join(__dirname, '.seed-voice-stats-ids.json');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

// Deterministic-ish helpers
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr, weights) => {
  if (!weights) return arr[randInt(0, arr.length - 1)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

async function undo() {
  if (!fs.existsSync(IDS_FILE)) {
    console.log('Nothing to undo (no ids file found).');
    return;
  }
  const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8'));
  const { count } = await prisma.voice_stats.deleteMany({ where: { id: { in: ids } } });
  fs.unlinkSync(IDS_FILE);
  console.log(`Deleted ${count} seeded rows.`);
}

async function seed() {
  const guildId = arg('guild');
  if (!guildId) {
    console.error('Missing --guild <guildId>');
    process.exit(1);
  }
  const days = parseInt(arg('days', '42'), 10);

  // Reuse real ids so Discord lookups resolve to real names
  const existing = await prisma.voice_stats.findMany({
    where: { guild_id: guildId },
    select: { member_id: true, channel_id: true },
    distinct: ['member_id', 'channel_id'],
  });
  const memberIds = [
    ...new Set([
      ...existing.map((r) => r.member_id),
      ...(arg('members', '') ? arg('members').split(',') : []),
    ]),
  ];
  const channelIds = [...new Set(existing.map((r) => r.channel_id))];

  if (memberIds.length === 0 || channelIds.length === 0) {
    console.error(
      'No existing members/channels found for this guild — join a voice channel once first, or pass --members.'
    );
    process.exit(1);
  }

  // Per-member personality: how likely they are to be online on a given day
  const activity = new Map(memberIds.map((m) => [m, rand(0.35, 0.9)]));
  // Channel popularity weights
  const channelWeights = channelIds.map((_, i) => 1 / (i + 1));

  const rows = [];
  const now = Date.now();

  for (let d = days; d >= 1; d--) {
    const dayStart = new Date(now - d * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const weekend = [0, 6].includes(dayStart.getDay());

    for (const member of memberIds) {
      const p = activity.get(member) * (weekend ? 1.3 : 1);
      if (Math.random() > p) continue;

      const sessionsToday = randInt(1, weekend ? 3 : 2);
      for (let s = 0; s < sessionsToday; s++) {
        // Start time clustered around the evening (~20:00 ± 3h)
        const startHour = Math.min(23.4, Math.max(8, 20 + (Math.random() + Math.random() - 1) * 6));
        const start = new Date(dayStart.getTime() + startHour * 3_600_000 + rand(0, 30) * 60_000);
        const durationMs = rand(15, weekend ? 200 : 140) * 60_000;
        const end = new Date(start.getTime() + durationMs);
        const channel = pick(channelIds, channelWeights);

        const push = (type, from, to) =>
          rows.push({
            id: crypto.randomUUID(),
            guild_id: guildId,
            member_id: member,
            channel_id: channel,
            type,
            issued_on: from,
            ended_on: to,
          });

        push('VOICE', start, end);

        // Occasional overlapping states within the session
        if (Math.random() < 0.35) {
          const mutedStart = new Date(start.getTime() + rand(0, durationMs * 0.5));
          const mutedEnd = new Date(
            Math.min(end.getTime(), mutedStart.getTime() + rand(5, 40) * 60_000)
          );
          push('MUTED', mutedStart, mutedEnd);
        }
        if (Math.random() < 0.12) {
          const deafStart = new Date(start.getTime() + rand(0, durationMs * 0.6));
          const deafEnd = new Date(
            Math.min(end.getTime(), deafStart.getTime() + rand(5, 25) * 60_000)
          );
          push('DEAF', deafStart, deafEnd);
        }
        if (Math.random() < 0.08) {
          const streamStart = new Date(start.getTime() + rand(0, durationMs * 0.3));
          const streamEnd = new Date(
            Math.min(end.getTime(), streamStart.getTime() + rand(20, 90) * 60_000)
          );
          push('STREAMING', streamStart, streamEnd);
        }
      }
    }
  }

  await prisma.voice_stats.createMany({ data: rows });

  const previous = fs.existsSync(IDS_FILE) ? JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')) : [];
  fs.writeFileSync(IDS_FILE, JSON.stringify([...previous, ...rows.map((r) => r.id)]));

  console.log(
    `Inserted ${rows.length} rows across ${days} days for ${memberIds.length} member(s) and ${channelIds.length} channel(s) in guild ${guildId}.`
  );
  console.log('Undo with: node tools/seed-voice-stats.cjs --undo');
}

(has('undo') ? undo() : seed())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
