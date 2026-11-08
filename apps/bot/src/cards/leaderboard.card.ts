import { avatarSvg } from './avatars';
import { escapeXml, FONT_FAMILY, truncate } from './render';
import { CardTheme } from './themes';

export interface LeaderboardCardRow {
  rank: number;
  name: string;
  /** Already formatted, e.g. "17h 45m" */
  value: string;
  /** Share of the leader's value, 0–1, for the bar */
  fraction: number;
  avatar?: string;
}

export interface LeaderboardCardData {
  serverName: string;
  serverIcon?: string;
  title: string;
  subtitle: string;
  footer: string;
  rows: LeaderboardCardRow[];
  /** Shown when there are no rows */
  empty: string;
}

const W = 800;
const PAD = 32;
const HEADER_H = 112;
const ROW_H = 56;
const ROW_GAP = 8;
const BAR_W = 460;

const text = (x: number, y: number, size: number, fill: string, content: string, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT_FAMILY}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;

const row = (r: LeaderboardCardRow, y: number, t: CardTheme) => {
  const filled = r.fraction > 0 ? Math.max(8, Math.min(1, r.fraction) * BAR_W) : 0;
  return [
    `<rect x="${PAD}" y="${y}" width="${W - 2 * PAD}" height="${ROW_H}" rx="12" fill="${t.surface}"/>`,
    text(72, y + ROW_H / 2, 20, r.rank <= 3 ? t.accent : t.muted, `${r.rank}`, 'dy="0.35em" text-anchor="middle" font-weight="700"'),
    avatarSvg({ id: `av${r.rank}`, x: 100, y: y + 8, size: 40, name: r.name, image: r.avatar, theme: t }),
    text(156, y + 25, 17, t.text, escapeXml(truncate(r.name, 32)), 'font-weight="700"'),
    `<rect x="156" y="${y + 36}" width="${BAR_W}" height="8" rx="4" fill="${t.track}"/>`,
    filled ? `<rect x="156" y="${y + 36}" width="${filled}" height="8" rx="4" fill="${t.accent}"/>` : '',
    text(W - PAD - 24, y + ROW_H / 2, 17, t.text, escapeXml(r.value), 'dy="0.35em" text-anchor="end" font-weight="700"'),
  ].join('');
};

/** One page of the leaderboard (up to 10 rows) as an SVG */
export const leaderboardCard = (d: LeaderboardCardData, t: CardTheme) => {
  const body = d.rows.length
    ? d.rows.map((r, i) => row(r, HEADER_H + i * (ROW_H + ROW_GAP), t)).join('')
    : `<rect x="${PAD}" y="${HEADER_H}" width="${W - 2 * PAD}" height="${ROW_H}" rx="12" fill="${t.surface}"/>` +
      text(W / 2, HEADER_H + ROW_H / 2, 17, t.muted, escapeXml(d.empty), 'dy="0.35em" text-anchor="middle"');
  const bodyEnd = HEADER_H + Math.max(1, d.rows.length) * (ROW_H + ROW_GAP) - ROW_GAP;
  const H = bodyEnd + 48;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" rx="24" fill="${t.background}"/>`,
    avatarSvg({ id: 'icon', x: PAD, y: 28, size: 56, name: d.serverName, image: d.serverIcon, theme: t }),
    text(104, 54, 26, t.text, escapeXml(truncate(d.title, 40)), 'font-weight="700"'),
    text(104, 82, 16, t.muted, escapeXml(truncate(`${d.serverName} · ${d.subtitle}`, 60))),
    body,
    text(PAD, bodyEnd + 30, 13, t.muted, escapeXml(d.footer)),
    `</svg>`,
  ].join('');
};
