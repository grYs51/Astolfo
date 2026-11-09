import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { header, PAD, svgCard, text, W } from './svg';
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

/** Below the shared header, with the same gap as the other cards */
const BODY_Y = 136;
const ROW_H = 56;
const ROW_GAP = 8;
const BAR_W = 460;

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
    ? d.rows.map((r, i) => row(r, BODY_Y + i * (ROW_H + ROW_GAP), t)).join('')
    : `<rect x="${PAD}" y="${BODY_Y}" width="${W - 2 * PAD}" height="${ROW_H}" rx="12" fill="${t.surface}"/>` +
      text(W / 2, BODY_Y + ROW_H / 2, 17, t.muted, escapeXml(d.empty), 'dy="0.35em" text-anchor="middle"');
  const bodyEnd = BODY_Y + Math.max(1, d.rows.length) * (ROW_H + ROW_GAP) - ROW_GAP;

  return svgCard(bodyEnd + 48, t, [
    header({ name: d.serverName, avatar: d.serverIcon, title: d.title, subtitle: `${d.serverName} · ${d.subtitle}` }, t),
    body,
    text(PAD, bodyEnd + 30, 13, t.muted, escapeXml(d.footer)),
  ]);
};
