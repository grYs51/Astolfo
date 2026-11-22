import type { WrappedStats } from '@nx-stolfo/api-interfaces';
import { formatDuration, plural } from '../stats/messages';
import { avatarSvg } from './avatars';
import type { CardMember } from './members';
import { escapeXml, truncate } from './render';
import { calendar } from './stats.card';
import { bar, header, heading, PAD, panel, svgCard, text, tile, TILE_H, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface WrappedCardData {
  wrapped: WrappedStats;
  member: CardMember;
  serverName: string;
  /** Names of `wrapped.topChannels`, same order; undefined for one the card mustn't name */
  channelNames: (string | undefined)[];
  /** Names and avatars of `wrapped.buddies`, same order */
  buddies: CardMember[];
}

const HOUR = 60 * 60 * 1000;
const GAP = 16;
const HERO_Y = 136;
const HERO_H = 128;
const INNER_X = PAD + 24;
const INNER_W = W - 2 * PAD - 48;
const RIGHT = PAD + TILE_W + 16;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The rest of a chart's bars, next to the highlighted one in full accent */
const DIM = 0.4;

/** "312 hours" reads better than "13d 0h" for a year; short totals keep minutes */
export const formatHours = (ms: number) => (ms >= 10 * HOUR ? plural(Math.round(ms / HOUR), 'hour') : formatDuration(ms));

const levelTile = (xp: WrappedStats['xp']) => {
  if (xp.gained <= 0) return { value: xp.levelTo ? `Level ${xp.levelTo}` : '–', sub: 'no XP this year' };
  const sub = `+${xp.gained.toLocaleString('en-GB')} XP`;
  return { value: xp.levelFrom === xp.levelTo ? `Level ${xp.levelTo}` : `Level ${xp.levelFrom} → ${xp.levelTo}`, sub };
};

/** Vertical bars from `baseY` up to `maxH`, the `peak` one in full accent; empty ones a thin track line */
const bars = (values: number[], x: number, baseY: number, width: number, maxH: number, peak: number, t: CardTheme) => {
  const step = width / values.length;
  const w = +(step * 0.64).toFixed(2);
  const max = Math.max(0, ...values);
  return values.map((value, i) => {
    const bx = +(x + i * step + (step - w) / 2).toFixed(2);
    if (value <= 0 || max <= 0) return `<rect x="${bx}" y="${baseY - 2}" width="${w}" height="2" fill="${t.track}"/>`;
    const h = Math.max(3, +((value / max) * maxH).toFixed(2));
    const dim = i === peak ? '' : ` fill-opacity="${DIM}"`;
    return `<rect x="${bx}" y="${+(baseY - h).toFixed(2)}" width="${w}" height="${h}" rx="${Math.min(4, w / 2)}" fill="${t.accent}"${dim}/>`;
  });
};

/** Voice hours per month, the peak month highlighted and labelled */
const monthChart = (w: WrappedStats, y: number, t: CardTheme): [string[], number] => {
  const panelH = 176;
  const baseY = y + 28 + 132;
  const step = INNER_W / 12;
  const peak = w.peakMonth ? w.peakMonth.month - 1 : -1;
  const parts = [
    heading(y + 14, w.peakMonth ? `Voice by month · most in ${MONTHS[peak]}` : 'Voice by month', t),
    panel(PAD, y + 28, W - 2 * PAD, panelH, t),
    ...bars(w.months.map((m) => m.voiceMs), INNER_X, baseY, INNER_W, 96, peak, t),
    ...MONTHS.map((name, i) =>
      text(+(INNER_X + i * step + step / 2).toFixed(2), baseY + 22, 13, i === peak ? t.text : t.muted, name[0], 'text-anchor="middle"')
    ),
  ];
  if (w.peakMonth) {
    const x = +(INNER_X + peak * step + step / 2).toFixed(2);
    parts.push(text(x, baseY - 96 - 8, 13, t.text, escapeXml(formatHours(w.peakMonth.voiceMs)), 'text-anchor="middle" font-weight="700"'));
  }
  return [parts, 28 + panelH];
};

/** Up to five buddies: avatar, name and time together */
const buddyRow = (d: WrappedCardData, y: number, t: CardTheme): [string[], number] => {
  const list = d.wrapped.buddies.slice(0, 5);
  if (!list.length) return [[], -GAP];
  const panelH = 136;
  const col = (W - 2 * PAD) / 5;
  const parts = [heading(y + 14, 'Buddies · most time together in voice', t), panel(PAD, y + 28, W - 2 * PAD, panelH, t)];
  list.forEach((b, i) => {
    const cx = +(PAD + i * col + col / 2).toFixed(2);
    const name = d.buddies[i]?.name ?? 'Unknown member';
    parts.push(
      avatarSvg({ id: `b${i}`, x: cx - 28, y: y + 28 + 16, size: 56, name, image: d.buddies[i]?.avatar, theme: t }),
      text(cx, y + 28 + 96, 14, t.text, escapeXml(truncate(name, 15)), 'text-anchor="middle" font-weight="700"'),
      text(cx, y + 28 + 116, 13, t.muted, escapeXml(formatHours(b.togetherMs)), 'text-anchor="middle"')
    );
  });
  return [parts, 28 + panelH];
};

const SIDE_H = 156;

/** The top three voice channels as horizontal bars, in the left column */
const channelBars = (d: WrappedCardData, y: number, t: CardTheme) => {
  const list = d.wrapped.topChannels.slice(0, 3);
  const innerW = TILE_W - 48;
  const max = Math.max(0, ...list.map((c) => c.voiceMs));
  const parts = [heading(y + 14, 'Top channels', t), panel(PAD, y + 28, TILE_W, SIDE_H, t)];
  if (!list.length) parts.push(text(INNER_X, y + 28 + 40, 14, t.muted, 'No voice this year'));
  list.forEach((c, i) => {
    const rowY = y + 28 + 30 + i * 44;
    const name = d.channelNames[i];
    parts.push(
      text(INNER_X, rowY, 14, name ? t.text : t.muted, escapeXml(name ? `#${truncate(name, 22)}` : 'Private channel')),
      text(INNER_X + innerW, rowY, 13, t.muted, escapeXml(formatHours(c.voiceMs)), 'text-anchor="end"'),
      bar(INNER_X, rowY + 8, innerW, 8, max > 0 ? c.voiceMs / max : 0, t.accent, t, i === 0 ? 1 : 0.6)
    );
  });
  return parts;
};

/** Voice minutes per UTC hour as 24 bars, with the persona, in the right column */
const hourStrip = (w: WrappedStats, y: number, t: CardTheme) => {
  const x = RIGHT + 24;
  const innerW = TILE_W - 48;
  const baseY = y + 28 + 122;
  const parts = [
    text(RIGHT, y + 14, 14, t.muted, 'Time of day (UTC)'),
    panel(RIGHT, y + 28, TILE_W, SIDE_H, t),
    text(
      x,
      y + 28 + 32,
      17,
      t.text,
      escapeXml(w.persona ? `${w.persona.label} · busiest at ${w.persona.peakHour}:00` : 'No voice this year'),
      'font-weight="700"'
    ),
    ...bars(w.hours, x, baseY, innerW, 64, w.persona?.peakHour ?? -1, t),
  ];
  for (const hour of [0, 6, 12, 18]) parts.push(text(+(x + (hour * innerW) / 24).toFixed(2), baseY + 18, 11, t.muted, `${hour}:00`));
  return parts;
};

const gamesLine = (g: WrappedStats['games']) =>
  [
    g.rockPaperScissors ? `${plural(g.rockPaperScissors, 'rock paper scissors win')}` : '',
    g.ticTacToe ? `${plural(g.ticTacToe, 'tic-tac-toe win')}` : '',
    g.trivia ? `${plural(g.trivia, 'trivia answer')} right` : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** /wrapped: one member's year on a server, Spotify Wrapped style */
export const wrappedCard = (d: WrappedCardData, t: CardTheme) => {
  const w = d.wrapped;
  const row = (i: number) => HERO_Y + HERO_H + GAP + i * (TILE_H + GAP);
  const level = levelTile(w.xp);
  const duo = w.buddies[0];
  const favourite = w.topChannels.length ? d.channelNames[0] : undefined;

  const parts = [
    header({ name: d.member.name, avatar: d.member.avatar, title: `${w.year} Wrapped`, subtitle: `${d.member.name} on ${d.serverName}` }, t),
    panel(PAD, HERO_Y, W - 2 * PAD, HERO_H, t),
    text(INNER_X, HERO_Y + 36, 16, t.muted, 'Time in voice'),
    text(INNER_X, HERO_Y + 92, 52, t.accent, escapeXml(formatHours(w.voiceMs)), 'font-weight="700"'),
    text(INNER_X, HERO_Y + 116, 14, t.muted, escapeXml(plural(w.sessions, 'session'))),
    ...(w.voiceRank
      ? [
          text(W - PAD - 24, HERO_Y + 92, 40, t.text, escapeXml(`Top ${w.voiceRank.topPercent}%`), 'text-anchor="end" font-weight="700"'),
          text(W - PAD - 24, HERO_Y + 116, 14, t.muted, escapeXml(`#${w.voiceRank.rank} of ${w.voiceRank.members} voice members`), 'text-anchor="end"'),
        ]
      : []),
    tile(PAD, row(0), 'Longest session', w.longestSessionMs ? formatDuration(w.longestSessionMs) : '–', undefined, t),
    tile(RIGHT, row(0), 'Favourite channel', favourite ? `#${favourite}` : w.topChannels.length ? 'Private channel' : '–', undefined, t),
    tile(PAD, row(1), 'Top duo', duo ? (d.buddies[0]?.name ?? 'Unknown member') : '–', duo ? `${formatHours(duo.togetherMs)} together` : undefined, t),
    tile(RIGHT, row(1), 'Peak month', w.peakMonth ? MONTHS[w.peakMonth.month - 1] : '–', w.peakMonth ? `${formatHours(w.peakMonth.voiceMs)} in voice` : undefined, t),
    tile(PAD, row(2), 'Longest streak', w.longestStreak ? plural(w.longestStreak, 'day') : '–', w.longestStreak ? 'in a row with 10+ min in voice' : undefined, t),
    tile(RIGHT, row(2), 'Messages sent', w.messages.toLocaleString('en-GB'), undefined, t),
    tile(PAD, row(3), 'Milestones', w.milestones.length ? w.milestones.map((h) => `${h}h`).join(' · ') : '–', w.milestones.length ? 'lifetime voice hours passed' : 'none this year', t),
    tile(RIGHT, row(3), 'Level', level.value, level.sub, t),
  ];

  let y = row(4);
  const add = ([section, height]: [string[], number]) => {
    parts.push(...section);
    y += height + GAP;
  };
  add(monthChart(w, y, t));
  add(buddyRow(d, y, t));
  add([[...channelBars(d, y, t), ...hourStrip(w, y, t)], 28 + SIDE_H]);
  const games = gamesLine(w.games);
  if (games) {
    add([[panel(PAD, y, W - 2 * PAD, 56, t), text(INNER_X, y + 34, 14, t.muted, 'Games'), text(INNER_X + 64, y + 34, 15, t.text, escapeXml(games))], 56]);
  }
  add(calendar(w.days, y, t, `${w.year}`));

  return svgCard(y + 40, t, [...parts, text(PAD, y + 18, 13, t.muted, escapeXml(`${truncate(d.serverName, 50)} · ${w.year}`))]);
};
