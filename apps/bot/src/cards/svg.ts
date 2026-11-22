import { avatarSvg } from './avatars';
import { escapeXml, FONT_FAMILY, truncate } from './render';
import { CardTheme } from './themes';

/** Building blocks the card templates share. Callers escape their own strings unless noted. */

export const W = 800;
export const PAD = 32;
export const TILE_W = (W - 2 * PAD - 16) / 2;
export const TILE_H = 104;

export const text = (x: number, y: number, size: number, fill: string, content: string, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;

export const panel = (x: number, y: number, w: number, h: number, t: CardTheme) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${t.surface}"/>`;

/** A muted heading above a section */
export const heading = (y: number, label: string, t: CardTheme) => text(PAD, y, 14, t.muted, escapeXml(label));

/** A bar with a rounded track; `fill` 0–1 */
export const bar = (x: number, y: number, w: number, h: number, fill: number, color: string, t: CardTheme, opacity = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${t.track}"/>` +
  (fill > 0
    ? `<rect x="${x}" y="${y}" width="${+(fill * w).toFixed(2)}" height="${h}" rx="${h / 2}" fill="${color}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
    : '');

/** Bold Inter averages a bit over half an em a character in names */
const CHAR_EM = 0.55;
/** One line shrinks down to this, then the value wraps onto two lines */
const ONE_LINE_MIN = 20;
const MIN_SIZE = 14;

/** `value` in two lines of at most `max` characters, broken at the last space that allows it (or mid-word); undefined when it doesn't fit */
const twoLines = (value: string, max: number): [string, string] | undefined => {
  const chars = [...value];
  if (chars.length > 2 * max) return undefined;
  const space = chars.slice(0, max + 1).lastIndexOf(' ');
  const cut = space > 0 && chars.length - space - 1 <= max ? space : max;
  const rest = chars.slice(cut).join('').trim();
  return [...rest].length <= max ? [chars.slice(0, cut).join('').trim(), rest] : undefined;
};

/**
 * Fits a tile's value in `width`: one line from `max` down to 20 px, then two
 * lines from 20 px down to 14, then two lines at 14 with the end cut.
 */
export const fitValue = (value: string, width: number, max: number): { size: number; lines: string[] } => {
  const perLine = (size: number) => Math.floor(width / (size * CHAR_EM));
  const one = Math.min(max, Math.floor(width / ([...value].length * CHAR_EM)));
  if (one >= ONE_LINE_MIN) return { size: one, lines: [value] };
  for (let size = ONE_LINE_MIN; size >= MIN_SIZE; size--) {
    const lines = twoLines(value, perLine(size));
    if (lines) return { size, lines };
  }
  const n = perLine(MIN_SIZE);
  const chars = [...value];
  return { size: MIN_SIZE, lines: [chars.slice(0, n).join('').trim(), truncate(chars.slice(n).join('').trim(), n)] };
};

/** A label, a big value (smaller or on two lines when it's long, e.g. a name) and an optional line under it (all escaped here) */
export const tile = (x: number, y: number, label: string, value: string, sub: string | undefined, t: CardTheme, w = TILE_W) => {
  const big = fitValue(value, w - 48, 30);
  const two = big.lines.length === 2;
  // Two lines move the label up a little to make room
  const lines = two
    ? big.lines.map((line, i) => text(x + 24, y + 52 + i * (big.size + 3), big.size, t.text, escapeXml(line), 'font-weight="700"')).join('')
    : text(x + 24, y + 68, big.size, t.text, escapeXml(big.lines[0]), 'font-weight="700"');
  return (
    panel(x, y, w, TILE_H, t) +
    text(x + 24, two ? y + 27 : y + 32, 14, t.muted, escapeXml(label)) +
    lines +
    (sub ? text(x + 24, two ? y + 96 : y + 90, 14, sub.startsWith('↑') ? t.accent : t.muted, escapeXml(truncate(sub, Math.floor(w / 9)))) : '')
  );
};

/** Big avatar, title and a muted line under it, across the top (escaped here); ends at y = 112 */
export const header = (h: { name: string; avatar?: string; title: string; subtitle: string }, t: CardTheme) =>
  avatarSvg({ id: 'me', x: PAD, y: 32, size: 72, name: h.name, image: h.avatar, theme: t }) +
  text(124, 64, 28, t.text, escapeXml(truncate(h.title, 36)), 'font-weight="700"') +
  text(124, 94, 16, t.muted, escapeXml(truncate(h.subtitle, 60)));

/** The rounded background and the svg root around a card's parts */
export const svgCard = (height: number, t: CardTheme, parts: string[]) =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`,
    `<rect width="${W}" height="${height}" rx="24" fill="${t.background}"/>`,
    ...parts,
    `</svg>`,
  ].join('');

const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1];

/** 0 for nothing, otherwise 1–4 by share of the busiest value (calendar and heatmap squares) */
export const level = (value: number, max: number) =>
  value > 0 && max > 0 ? Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) : 0;

/** One square of a calendar or heatmap: `track` when empty, `accent` stronger with the level */
export const gridCell = (x: number, y: number, size: number, lvl: number, t: CardTheme) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${lvl ? t.accent : t.track}"${lvl ? ` fill-opacity="${LEVEL_OPACITY[lvl]}"` : ''}/>`;
