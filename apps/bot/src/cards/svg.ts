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

/** A label, a big value and an optional line under it (all escaped here) */
export const tile = (x: number, y: number, label: string, value: string, sub: string | undefined, t: CardTheme, w = TILE_W) =>
  panel(x, y, w, TILE_H, t) +
  text(x + 24, y + 32, 14, t.muted, escapeXml(label)) +
  text(x + 24, y + 68, 30, t.text, escapeXml(value), 'font-weight="700"') +
  (sub ? text(x + 24, y + 90, 14, sub.startsWith('↑') ? t.accent : t.muted, escapeXml(truncate(sub, Math.floor(w / 9)))) : '');

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
