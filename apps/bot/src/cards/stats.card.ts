import type { ActivityCalendar, StatsCardSection, VoiceHabits, XpLevel } from '@nx-stolfo/api-interfaces';
import { formatDuration, PERIOD_LABEL, plural, PREVIOUS_LABEL } from '../stats/messages';
import { nextMilestone } from '../stats/milestones';
import type { MemberSummary } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { gridCell, header, level, PAD, panel, svgCard, text, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

/** The parts of the card a viewer can turn on, in the order they're drawn */
export const STATS_CARD_SECTIONS: readonly StatsCardSection[] = ['totals', 'streak', 'habits', 'calendar', 'heatmap', 'companions'];
export type { StatsCardSection };
/** What /stats shows */
export const DEFAULT_SECTIONS: readonly StatsCardSection[] = ['totals', 'streak', 'companions'];

export interface RankingRow {
  name: string;
  avatar?: string;
  voiceMs: number;
  rank: number;
  /** The member the card is about */
  subject: boolean;
}

/** Voice minutes in one local (weekday, hour); `day` 0 = Sunday, like Postgres DOW */
export interface HeatmapCell {
  day: number;
  hour: number;
  minutes: number;
}

export interface StatsCardData {
  summary: MemberSummary;
  period: StatsPeriod;
  memberName: string;
  avatar?: string;
  serverName: string;
  /** Same order as summary.companions */
  companions: { name: string; avatar?: string }[];
  /** The member and their neighbours by voice time (totals); left out when they have no voice time */
  ranking?: { members: number; rows: RankingRow[] };
  /** Online time in the period and its share of it (habits); left out when unknown */
  online?: { ms: number; share: number };
  /** false when someone else looks at the card, so it doesn't say "you" */
  self?: boolean;
  /** Defaults to DEFAULT_SECTIONS */
  sections?: readonly StatsCardSection[];
  /** Needed for the matching section; a section without its data is left out */
  habits?: VoiceHabits;
  calendar?: ActivityCalendar;
  heatmap?: HeatmapCell[];
  /** Level and XP on the server, drawn above the streak */
  xp?: XpLevel;
}

const H = 60 * 60 * 1000;
const COMPANION_H = 52;
const GAP = 16;
const INNER_W = W - 2 * PAD - 48;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A muted heading above a section */
const heading = (y: number, label: string, t: CardTheme) => text(PAD, y, 14, t.muted, escapeXml(label));

/** Labels for the this-period vs previous-period bars */
const COMPARE_LABELS: Record<Exclude<StatsPeriod, 'all'>, [string, string]> = {
  week: ['Past week', 'Week before'],
  month: ['Past month', 'Month before'],
  year: ['Past year', 'Year before'],
};

/** Habit meter and streak colours, the same as the dashboard's */
const COLORS = { muted: '#FBBF24', camera: '#38BDF8', streaming: '#F472B6', online: '#34D399', streak: '#FBBF24' };

const INNER_X = PAD + 24;

/** A bar with a rounded track; `fill` 0–1 */
const bar = (x: number, y: number, w: number, h: number, fill: number, color: string, t: CardTheme, opacity = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.track}"/>` +
  (fill > 0
    ? `<rect x="${x}" y="${y}" width="${+(fill * w).toFixed(2)}" height="${h}" rx="${h / 2}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
    : '');

/** Hours and minutes, never rolled up into days ("85h 44m") */
const hoursAndMinutes = (ms: number) => `${Math.floor(ms / H)}h ${Math.floor((ms % H) / 60_000)}m`;

/**
 * The headline (the change against the previous period, or the totals for all
 * time), both periods as bars, then sessions, average session and chat rank.
 * Then the voice ranking: the member between whoever is just above and below.
 */
const totals = (d: StatsCardData, y: number, t: CardTheme): [string[], number] => {
  const s = d.summary;
  const subject = d.self === false ? escapeXml(truncate(d.memberName, 24)) : 'You';
  const accent = (value: string) => `<tspan fill="${t.accent}">${escapeXml(value)}</tspan>`;
  const previous = d.period === 'all' ? undefined : s.previousVoiceMs;
  const labels = d.period === 'all' ? undefined : COMPARE_LABELS[d.period];
  // Nothing to compare when there was no voice in either period
  const compare = labels && previous != null && (s.voiceMs > 0 || previous > 0) ? { labels, previous } : undefined;

  let lines: [string, string];
  if (compare) {
    const diff = s.voiceMs - compare.previous;
    const before = d.period === 'all' ? '' : PREVIOUS_LABEL[d.period];
    lines =
      Math.abs(diff) < 60_000
        ? [`${subject} spent about as long in voice`, `as ${before}.`]
        : [`${subject} spent ${accent(`${formatDuration(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}`)}`, `in voice than ${before}.`];
  } else {
    lines = [
      s.sessions > 0 ? `${subject} spent ${accent(formatDuration(s.voiceMs))} in voice` : `${subject} ${d.self === false ? 'wasn’t' : 'weren’t'} in voice`,
      `and sent ${accent(plural(s.messages, 'message'))} over ${PERIOD_LABEL[d.period]}.`,
    ];
  }

  const parts = [
    text(INNER_X, y + 48, 26, t.text, lines[0], 'font-weight="700"'),
    text(INNER_X, y + 82, 26, t.text, lines[1], 'font-weight="700"'),
  ];
  let rowY = y + 82;
  if (compare) {
    const max = Math.max(s.voiceMs, compare.previous, 1);
    const barX = INNER_X + 128;
    const barW = INNER_W - 128 - 96;
    (
      [
        [compare.labels[0], s.voiceMs, true],
        [compare.labels[1], compare.previous, false],
      ] as const
    ).forEach(([label, ms, current], i) => {
      const cy = y + 122 + i * 30;
      const color = current ? t.text : t.muted;
      parts.push(
        text(INNER_X, cy, 15, color, label, 'dy="0.35em"'),
        bar(barX, cy - 4, barW, 8, ms / max, current ? t.accent : t.muted, t, current ? 1 : 0.5),
        text(INNER_X + INNER_W, cy, 15, color, escapeXml(formatDuration(ms)), 'dy="0.35em" text-anchor="end"')
      );
    });
    rowY = y + 152;
  }

  // The message count left the headline when there's a comparison, so it's always here
  const stats = [
    s.sessions > 0 && { label: 'Sessions', value: `${s.sessions}` },
    s.sessions > 0 && { label: 'Average session', value: formatDuration(s.voiceMs / s.sessions) },
    s.messages > 0 &&
      (s.messageRank
        ? { label: 'In chat', value: `#${s.messageRank}`, sub: plural(s.messages, 'message') }
        : { label: 'In chat', value: plural(s.messages, 'message') }),
  ].filter((item): item is { label: string; value: string; sub?: string } => !!item);
  const colW = INNER_W / 3;
  if (stats.length) parts.push(`<rect x="${INNER_X}" y="${rowY + 26}" width="${INNER_W}" height="1" fill="${t.track}"/>`);
  stats.forEach(({ label, value, sub }, i) => {
    const x = INNER_X + i * colW;
    parts.push(
      text(x, rowY + 56, 14, t.muted, escapeXml(label)),
      text(
        x,
        rowY + 84,
        20,
        t.text,
        escapeXml(value) + (sub ? `<tspan fill="${t.muted}" font-size="14" font-weight="400">&#160;· ${escapeXml(sub)}</tspan>` : ''),
        'font-weight="700"'
      )
    );
  });
  const panelH = (stats.length ? rowY + 106 : rowY + 26) - y;
  parts.unshift(panel(PAD, y, W - 2 * PAD, panelH, t));

  if (!d.ranking?.rows.length) return [parts, panelH];
  const [rankParts, rankH] = ranking(d, d.ranking, y + panelH + GAP, t);
  return [[...parts, ...rankParts], panelH + GAP + rankH];
};

const RANK_ROW_H = 56;

/** Whoever is just above and below the member by voice time, and the gap to the next rank */
const ranking = (d: StatsCardData, r: NonNullable<StatsCardData['ranking']>, y: number, t: CardTheme): [string[], number] => {
  const me = r.rows.findIndex((row) => row.subject);
  const you = r.rows[me];
  const ahead = r.rows[me - 1];
  const behind = r.rows[me + 1];
  const max = Math.max(r.rows[0].voiceMs, 1);
  const name = (row: RankingRow) => (row.subject && d.self !== false ? 'You' : row.name);
  const panelH = r.rows.length * RANK_ROW_H + 8 + 40;
  const parts = [
    heading(y + 14, `Voice ranking · #${you?.rank ?? '–'} of ${r.members}`, t),
    panel(PAD, y + 28, W - 2 * PAD, panelH, t),
  ];
  r.rows.forEach((row, i) => {
    const rowY = y + 32 + i * RANK_ROW_H;
    if (row.subject) {
      parts.push(
        `<rect x="${PAD + 12}" y="${rowY + 2}" width="${W - 2 * PAD - 24}" height="${RANK_ROW_H - 4}" rx="12" fill="${t.accent}" fill-opacity="0.12" stroke="${t.accent}" stroke-opacity="0.35"/>`
      );
    }
    parts.push(
      text(PAD + 28, rowY + RANK_ROW_H / 2, 14, t.muted, `#${row.rank}`, 'dy="0.35em"'),
      avatarSvg({ id: `r${i}`, x: PAD + 72, y: rowY + 10, size: 36, name: row.name, image: row.avatar, theme: t }),
      text(PAD + 124, rowY + 24, 17, t.text, escapeXml(truncate(name(row), 32)), row.subject ? 'font-weight="700"' : ''),
      text(W - PAD - 28, rowY + 24, 15, t.muted, escapeXml(formatDuration(row.voiceMs)), 'text-anchor="end"'),
      bar(PAD + 124, rowY + 36, W - 2 * PAD - 152, 6, row.voiceMs / max, row.subject ? t.accent : t.muted, t, row.subject ? 1 : 0.6)
    );
  });
  const gap = (ms: number) => `<tspan fill="${t.text}" font-weight="700">${escapeXml(formatDuration(ms))}</tspan>`;
  const sentence = ahead
    ? ahead.voiceMs - you.voiceMs < 60_000
      ? `Neck and neck with ${escapeXml(ahead.name)} for #${ahead.rank}.`
      : `${gap(ahead.voiceMs - you.voiceMs)} behind ${escapeXml(truncate(ahead.name, 28))} for #${ahead.rank}.`
    : behind
      ? `On top, ${gap(you.voiceMs - behind.voiceMs)} ahead of ${escapeXml(truncate(behind.name, 28))}.`
      : `Nobody else was in voice over ${PERIOD_LABEL[d.period]}.`;
  parts.push(text(INNER_X, y + 28 + r.rows.length * RANK_ROW_H + 30, 15, t.muted, sentence));
  return [parts, 28 + panelH];
};

const LEVEL_H = 108;

/** Level, total XP and a bar to the next level, full width */
const levelRow = (xp: XpLevel, y: number, t: CardTheme) => {
  const w = W - 2 * PAD;
  const barW = w - 48;
  const span = xp.nextLevelXp - xp.levelXp;
  const filled = span > 0 ? Math.max(0, Math.min(1, (xp.xp - xp.levelXp) / span)) : 0;
  const n = (v: number) => v.toLocaleString('en-GB');
  return [
    panel(PAD, y, w, LEVEL_H, t),
    text(PAD + 24, y + 32, 14, t.muted, 'Level'),
    text(PAD + 24, y + 68, 30, t.text, `${xp.level}<tspan fill="${t.muted}" font-size="14" font-weight="400">&#160;· ${n(xp.xp)} XP</tspan>`, 'font-weight="700"'),
    text(PAD + w - 24, y + 68, 14, t.muted, `${n(xp.nextLevelXp - xp.xp)} XP to level ${xp.level + 1}`, 'text-anchor="end"'),
    `<rect x="${PAD + 24}" y="${y + 84}" width="${barW}" height="8" rx="4" fill="${t.track}"/>`,
    filled > 0 ? `<rect x="${PAD + 24}" y="${y + 84}" width="${+(barW * filled).toFixed(2)}" height="8" rx="4" fill="${t.accent}"/>` : '',
  ];
};

/** Most pips the streak row draws; longer streaks are scaled down to fit */
const MAX_STREAK_PIPS = 14;

/**
 * The voice streak with a pip per day against the best one, and the next
 * milestone as a square per hour, like the calendar (both all time), under the level.
 */
const streak = (d: StatsCardData, top: number, t: CardTheme): [string[], number] => {
  const level = d.xp ? levelRow(d.xp, top, t) : [];
  const above = d.xp ? LEVEL_H + GAP : 0;
  const y = top + above;
  const s = d.summary;
  const next = nextMilestone(s.lifetimeMs);
  const tiles: { height: (w: number) => number; draw: (x: number, w: number, h: number) => string[] }[] = [];

  if (s.streak.longest > 0) {
    tiles.push({
      height: () => TILE_H + 16,
      draw: (x, w, h) => {
        const pips = Math.min(s.streak.longest, MAX_STREAK_PIPS);
        const filled = Math.round((s.streak.current / s.streak.longest) * pips);
        const pipW = Math.min(24, (w - 48 - (pips - 1) * 4) / pips);
        return [
          panel(x, y, w, h, t),
          text(x + 24, y + 32, 14, t.muted, 'Voice streak'),
          text(
            x + 24,
            y + 68,
            30,
            t.text,
            escapeXml(plural(s.streak.current, 'day')) + `<tspan fill="${t.muted}" font-size="14" font-weight="400">&#160;· best ${s.streak.longest}</tspan>`,
            'font-weight="700"'
          ),
          ...Array.from(
            { length: pips },
            (_, i) => `<rect x="${+(x + 24 + i * (pipW + 4)).toFixed(2)}" y="${y + 88}" width="${+pipW.toFixed(2)}" height="8" rx="4" fill="${i < filled ? COLORS.streak : t.track}"/>`
          ),
        ];
      },
    });
  }

  if (next) {
    const hoursDone = (next.hours * H - next.remainingMs) / H;
    const done = Math.floor(hoursDone);
    // One square per hour; wider rows for the bigger milestones (1000 = 20 rows of 50)
    const columns = next.hours <= 50 ? 10 : next.hours <= 250 ? 25 : 50;
    const rows = Math.ceil(next.hours / columns);
    const step = (w: number) => Math.min(14, (w - 48 + 2) / columns);
    tiles.push({
      height: (w) => Math.round(48 + rows * step(w) + 40),
      draw: (x, w, h) => {
        const cell = step(w);
        const gridY = y + 48;
        return [
          panel(x, y, w, h, t),
          text(x + 24, y + 32, 14, t.muted, `${next.hours} hours in voice`),
          ...Array.from({ length: next.hours }, (_, i) =>
            gridCell(
              +(x + 24 + (i % columns) * cell).toFixed(2),
              +(gridY + Math.floor(i / columns) * cell).toFixed(2),
              +(cell - 2).toFixed(2),
              i < done ? 4 : i === done && hoursDone > done ? 2 : 0,
              t
            )
          ),
          text(
            x + 24,
            gridY + rows * cell + 24,
            17,
            t.text,
            escapeXml(hoursAndMinutes(next.remainingMs)) + `<tspan fill="${t.muted}" font-weight="400">&#160;to go</tspan>`,
            'font-weight="700"'
          ),
        ];
      },
    });
  }

  if (!tiles.length) return [level, above - GAP];
  const w = tiles.length === 1 ? W - 2 * PAD : TILE_W;
  const h = Math.max(...tiles.map((tile) => tile.height(w)));
  return [[...level, ...tiles.flatMap((tile, i) => tile.draw(PAD + i * (TILE_W + GAP), w, h))], above + h];
};

const METER_PARTS = 5;

/**
 * Muted, camera, streaming and online as shares, each a bar in five parts
 * (20% each) like the dashboard's meters. Online is left out when unknown.
 */
const habits = (h: VoiceHabits, online: StatsCardData['online'], y: number, t: CardTheme): [string[], number] => {
  // muted includes self-deafened time but not server deafen, so take the larger
  const muted = Math.max(h.muted, h.deafened);
  const meters = [
    ...(h.voice > 0
      ? [
          { label: 'Muted', color: COLORS.muted, share: muted / h.voice, note: `${formatDuration(muted)} of voice` },
          { label: 'Camera', color: COLORS.camera, share: h.video / h.voice, note: `${formatDuration(h.video)} of voice` },
          { label: 'Streaming', color: COLORS.streaming, share: h.streaming / h.voice, note: `${formatDuration(h.streaming)} of voice` },
        ]
      : []),
    ...(online ? [{ label: 'Online', color: COLORS.online, share: online.share, note: `${formatDuration(online.ms)} in total` }] : []),
  ];
  if (!meters.length) return [[], -GAP];

  const colGap = 24;
  const colW = (INNER_W - (meters.length - 1) * colGap) / meters.length;
  const partW = (colW - (METER_PARTS - 1) * 6) / METER_PARTS;
  const parts = [heading(y + 14, 'Voice habits', t), panel(PAD, y + 28, W - 2 * PAD, 108, t)];
  meters.forEach((m, i) => {
    const x = INNER_X + i * (colW + colGap);
    parts.push(
      text(x, y + 62, 14, t.muted, m.label),
      text(x + colW, y + 62, 17, t.text, `${Math.round(m.share * 100)}%`, 'font-weight="700" text-anchor="end"'),
      ...Array.from({ length: METER_PARTS }, (_, j) =>
        bar(+(x + j * (partW + 6)).toFixed(2), y + 76, +partW.toFixed(2), 8, Math.min(1, Math.max(0, m.share * METER_PARTS - j)), m.color, t)
      ),
      text(x, y + 112, 13, t.muted, escapeXml(m.note))
    );
  });
  return [parts, 28 + 108];
};

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** The past year, a square per day in weeks of Monday to Sunday, coloured by voice minutes */
const calendar = (c: ActivityCalendar, y: number, t: CardTheme): [string[], number] => {
  const first = toUtc(c.start).getTime();
  const days = Math.round((toUtc(c.end).getTime() - first) / (24 * H)) + 1;
  const offset = (toUtc(c.start).getUTCDay() + 6) % 7;
  const columns = Math.ceil((days + offset) / 7);
  // Fractional, so the 53–54 weeks fill the panel
  const step = (INNER_W + 3) / columns;
  const size = +(step - 3).toFixed(2);
  const byDate = new Map(c.days.map((day) => [day.date, day]));
  const max = Math.max(0, ...c.days.map((day) => day.minutes));
  const gridY = y + 28 + 24 + 18;
  const parts = [
    heading(y + 14, `Past year · ${plural(c.days.length, 'active day')}`, t),
    panel(PAD, y + 28, W - 2 * PAD, Math.round(24 + 18 + 7 * step + 21), t),
  ];
  let lastLabel = -3;
  for (let i = 0; i < days; i++) {
    const date = new Date(first + i * 24 * H);
    const iso = date.toISOString().substring(0, 10);
    const col = Math.floor((i + offset) / 7);
    const row = (i + offset) % 7;
    const x = +(PAD + 24 + col * step).toFixed(2);
    const day = byDate.get(iso);
    // Days with only messages still show as active
    const lvl = day ? Math.max(level(day.minutes, max), day.messages > 0 ? 1 : 0) : 0;
    parts.push(gridCell(x, +(gridY + row * step).toFixed(2), size, lvl, t));
    if (date.getUTCDate() === 1 && col - lastLabel >= 3) {
      parts.push(text(x, gridY - 8, 11, t.muted, date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })));
      lastLabel = col;
    }
  }
  return [parts, Math.round(28 + 24 + 18 + 7 * step + 21)];
};

/** Voice time per weekday and hour in the period, in the viewer's time zone */
const heatmap = (cells: HeatmapCell[], self: boolean, y: number, t: CardTheme): [string[], number] => {
  const labelW = 40;
  const step = Math.floor((INNER_W - labelW) / 24);
  const size = step - 3;
  const max = Math.max(0, ...cells.map((c) => c.minutes));
  const minutes = new Map(cells.map((c) => [`${(c.day + 6) % 7}:${c.hour}`, c.minutes]));
  const gridX = PAD + 24 + labelW;
  const gridY = y + 28 + 24;
  const parts = [
    heading(y + 14, self ? 'When you’re in voice' : 'When they’re in voice', t),
    panel(PAD, y + 28, W - 2 * PAD, 24 + 7 * step + 36, t),
  ];
  DAYS.forEach((name, row) => {
    parts.push(text(PAD + 24, gridY + row * step + size / 2, 12, t.muted, name, 'dy="0.35em"'));
    for (let hour = 0; hour < 24; hour++) {
      parts.push(gridCell(gridX + hour * step, gridY + row * step, size, level(minutes.get(`${row}:${hour}`) ?? 0, max), t));
    }
  });
  for (const hour of [0, 6, 12, 18]) {
    parts.push(text(gridX + hour * step, gridY + 7 * step + 14, 11, t.muted, `${hour}:00`));
  }
  return [parts, 28 + 24 + 7 * step + 36];
};

/** Who they shared a channel with most */
const companions = (d: StatsCardData, y: number, t: CardTheme): [string[], number] => {
  const list = d.summary.companions.slice(0, 3);
  if (!list.length) return [[], -GAP];
  const parts = [
    heading(y + 14, d.self === false ? 'Hangs out most with' : 'You hang out most with', t),
    panel(PAD, y + 28, W - 2 * PAD, list.length * COMPANION_H + 8, t),
  ];
  list.forEach((c, i) => {
    const rowY = y + 32 + i * COMPANION_H;
    const name = d.companions[i]?.name ?? 'Unknown member';
    parts.push(
      avatarSvg({ id: `c${i}`, x: PAD + 20, y: rowY + 8, size: 36, name, image: d.companions[i]?.avatar, theme: t }),
      text(PAD + 72, rowY + 26, 17, t.text, escapeXml(truncate(name, 40)), 'dy="0.35em" font-weight="700"'),
      text(W - PAD - 24, rowY + 26, 17, t.text, escapeXml(formatDuration(c.togetherMs)), 'dy="0.35em" text-anchor="end"')
    );
  });
  return [parts, 28 + list.length * COMPANION_H + 8];
};

/** A member's stats as an SVG, with the sections the viewer picked (/stats and the dashboard) */
export const statsCard = (d: StatsCardData, t: CardTheme) => {
  const s = d.summary;
  const on = new Set(d.sections ?? DEFAULT_SECTIONS);
  const empty = s.sessions === 0 && s.messages === 0;
  const parts: string[] = [];
  let y = 136;

  const add = ([section, height]: [string[], number]) => {
    parts.push(...section);
    y += height + GAP;
  };

  if (empty) {
    add([
      [
        panel(PAD, y, W - 2 * PAD, 72, t),
        text(W / 2, y + 36, 17, t.muted, escapeXml(d.self === false ? `No voice or messages over ${PERIOD_LABEL[d.period]}.` : `You haven’t been in voice or sent messages over ${PERIOD_LABEL[d.period]}.`), 'dy="0.35em" text-anchor="middle"'),
      ],
      72,
    ]);
  } else {
    if (on.has('totals')) add(totals(d, y, t));
    if (on.has('streak')) add(streak(d, y, t));
    if (on.has('habits') && d.habits) add(habits(d.habits, d.online, y, t));
  }
  // The calendar covers the past year whatever the period, so it shows even when the period is empty
  if (on.has('calendar') && d.calendar) add(calendar(d.calendar, y, t));
  if (!empty) {
    // No cells: messages but no voice in the period
    if (on.has('heatmap') && d.heatmap?.length) add(heatmap(d.heatmap, d.self !== false, y, t));
    if (on.has('companions')) add(companions(d, y, t));
  }
  // Picked parts with nothing in them (habits without voice, no companions): say so instead of an empty card
  if (!parts.length) {
    add([
      [
        panel(PAD, y, W - 2 * PAD, 72, t),
        text(W / 2, y + 36, 17, t.muted, escapeXml(`Nothing to show in these parts over ${PERIOD_LABEL[d.period]}.`), 'dy="0.35em" text-anchor="middle"'),
      ],
      72,
    ]);
  }
  y -= GAP;

  return svgCard(y + 56, t, [
    header({ name: d.memberName, avatar: d.avatar, title: d.memberName, subtitle: `${d.serverName} · over ${PERIOD_LABEL[d.period]}` }, t),
    ...parts,
    text(PAD, y + 34, 13, t.muted, 'Open sessions count live'),
  ]);
};
