import type { ActivityCalendar, VoiceHabits } from '@nx-stolfo/api-interfaces';
import { formatChange, formatDuration, PERIOD_LABEL, plural, PREVIOUS_LABEL } from '../stats/messages';
import { nextMilestone } from '../stats/milestones';
import type { MemberSummary } from '../stats/queries';
import type { StatsPeriod } from '../stats/windows';
import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { gridCell, header, level, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

/** The parts of the card a viewer can turn on, in the order they're drawn */
export const STATS_CARD_SECTIONS = ['totals', 'streak', 'habits', 'calendar', 'heatmap', 'companions'] as const;
export type StatsCardSection = (typeof STATS_CARD_SECTIONS)[number];
/** What /stats shows */
export const DEFAULT_SECTIONS: readonly StatsCardSection[] = ['totals', 'streak', 'companions'];

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
  favouriteChannelName?: string;
  /** Same order as summary.companions */
  companions: { name: string; avatar?: string }[];
  /** false when someone else looks at the card, so it doesn't say "you" */
  self?: boolean;
  /** Defaults to DEFAULT_SECTIONS */
  sections?: readonly StatsCardSection[];
  /** Needed for the matching section; a section without its data is left out */
  habits?: VoiceHabits;
  calendar?: ActivityCalendar;
  heatmap?: HeatmapCell[];
}

const H = 60 * 60 * 1000;
const COMPANION_H = 52;
const GAP = 16;
const INNER_W = W - 2 * PAD - 48;
const SMALL_TILE_W = (W - 2 * PAD - 3 * GAP) / 4;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A muted heading above a section */
const heading = (y: number, label: string, t: CardTheme) => text(PAD, y, 14, t.muted, escapeXml(label));

/** Voice time, messages, rank and sessions; returns the parts and the height */
const totals = (d: StatsCardData, y: number, t: CardTheme): [string[], number] => {
  const s = d.summary;
  const previous = d.period === 'all' ? '' : PREVIOUS_LABEL[d.period];
  const right = PAD + TILE_W + GAP;
  const rankSub = [s.voiceRank && `of ${plural(s.rankedMembers, 'member')}`, s.messageRank && `#${s.messageRank} in messages`]
    .filter(Boolean)
    .join(' · ');
  const sessionsSub = [s.sessions > 0 && `avg ${formatDuration(s.voiceMs / s.sessions)}`, d.favouriteChannelName && `most in #${d.favouriteChannelName}`]
    .filter(Boolean)
    .join(' · ');
  return [
    [
      tile(PAD, y, 'Voice time', formatDuration(s.voiceMs), formatChange(s.voiceMs, s.previousVoiceMs, previous), t),
      tile(right, y, 'Messages', s.messages.toLocaleString('en-GB'), formatChange(s.messages, s.previousMessages, previous), t),
      tile(PAD, y + TILE_H + GAP, 'Rank in voice time', s.voiceRank ? `#${s.voiceRank}` : '–', rankSub || undefined, t),
      tile(right, y + TILE_H + GAP, 'Sessions', `${s.sessions}`, sessionsSub || undefined, t),
    ],
    2 * TILE_H + GAP,
  ];
};

/** The voice streak and the next milestone with a progress bar (both all time) */
const streak = (d: StatsCardData, y: number, t: CardTheme): [string[], number] => {
  const s = d.summary;
  const next = nextMilestone(s.lifetimeMs);
  const tiles: ((x: number, w: number) => string)[] = [];
  if (s.streak.longest > 0) {
    tiles.push((x, w) => tile(x, y, 'Voice streak', plural(s.streak.current, 'day'), `best ${s.streak.longest}`, t, w));
  }
  if (next) {
    const share = 1 - next.remainingMs / (next.hours * H);
    tiles.push((x, w) => {
      const barW = w - 48;
      return (
        tile(x, y, 'Next milestone', `${next.hours}h`, undefined, t, w) +
        text(x + w - 24, y + 68, 14, t.muted, escapeXml(`${formatDuration(next.remainingMs)} to go`), 'text-anchor="end"') +
        `<rect x="${x + 24}" y="${y + 82}" width="${barW}" height="8" rx="4" fill="${t.track}"/>` +
        `<rect x="${x + 24}" y="${y + 82}" width="${Math.max(8, share * barW)}" height="8" rx="4" fill="${t.accent}"/>`
      );
    });
  }
  if (!tiles.length) return [[], -GAP];
  const w = tiles.length === 1 ? W - 2 * PAD : TILE_W;
  return [tiles.map((draw, i) => draw(PAD + i * (TILE_W + GAP), w)), TILE_H];
};

/** Camera, streaming, listening and muted, like the dashboard's voice habits */
const habits = (h: VoiceHabits, y: number, t: CardTheme): [string[], number] => {
  if (h.voice <= 0) return [[], -GAP];
  const values: [string, string, string?][] = [
    ['Camera on', formatDuration(h.video)],
    ['Streaming', formatDuration(h.streaming)],
    ['Listening', formatDuration(h.voice - h.deafened)],
    ['Muted', `${Math.round((h.muted / h.voice) * 100)}%`, 'of voice'],
  ];
  return [
    [
      heading(y + 14, 'Voice habits', t),
      ...values.map(([label, value, sub], i) => tile(PAD + i * (SMALL_TILE_W + GAP), y + 28, label, value, sub, t, SMALL_TILE_W)),
    ],
    28 + TILE_H,
  ];
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
    if (on.has('habits') && d.habits) add(habits(d.habits, y, t));
  }
  // The calendar covers the past year whatever the period, so it shows even when the period is empty
  if (on.has('calendar') && d.calendar) add(calendar(d.calendar, y, t));
  if (!empty) {
    if (on.has('heatmap') && d.heatmap) add(heatmap(d.heatmap, d.self !== false, y, t));
    if (on.has('companions')) add(companions(d, y, t));
  }
  y -= GAP;

  return svgCard(y + 56, t, [
    header({ name: d.memberName, avatar: d.avatar, title: d.memberName, subtitle: `${d.serverName} · over ${PERIOD_LABEL[d.period]}` }, t),
    ...parts,
    text(PAD, y + 34, 13, t.muted, 'Open sessions count live'),
  ]);
};
