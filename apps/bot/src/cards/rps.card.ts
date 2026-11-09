import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { PAD, svgCard, text, TILE_W, W } from './svg';
import { CardTheme } from './themes';

export interface RpsPlayer {
  name: string;
  avatar?: string;
  /** rock, paper or scissors */
  move: string;
}

export interface RpsCardData {
  players: [RpsPlayer, RpsPlayer];
  /** Index of the winner; undefined on a tie */
  winner?: 0 | 1;
}

const TOP = 72;
const PANEL_H = 248;
const AVATAR = 96;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const player = (p: RpsPlayer, i: 0 | 1, won: boolean, t: CardTheme) => {
  const x = i === 0 ? PAD : W - PAD - TILE_W;
  const cx = x + TILE_W / 2;
  return [
    `<rect x="${x}" y="${TOP}" width="${TILE_W}" height="${PANEL_H}" rx="16" fill="${t.surface}"${won ? ` stroke="${t.accent}" stroke-width="3"` : ''}/>`,
    avatarSvg({ id: `p${i}`, x: cx - AVATAR / 2, y: TOP + 28, size: AVATAR, name: p.name, image: p.avatar, theme: t }),
    text(cx, TOP + 160, 20, t.text, escapeXml(truncate(p.name, 26)), 'text-anchor="middle" font-weight="700"'),
    text(cx, TOP + 206, 30, won ? t.accent : t.muted, escapeXml(capitalise(p.move)), 'text-anchor="middle" font-weight="700"'),
  ].join('');
};

/** The rock-paper-scissors result: both players, their moves and who won */
export const rpsCard = (d: RpsCardData, t: CardTheme) => {
  const result = d.winner === undefined ? 'It’s a tie!' : `${truncate(d.players[d.winner].name, 32)} wins!`;
  const bottom = TOP + PANEL_H;
  return svgCard(bottom + 88, t, [
    text(W / 2, 48, 16, t.muted, 'Rock paper scissors', 'text-anchor="middle"'),
    player(d.players[0], 0, d.winner === 0, t),
    player(d.players[1], 1, d.winner === 1, t),
    text(W / 2, TOP + PANEL_H / 2, 20, t.muted, 'vs', 'dy="0.35em" text-anchor="middle" font-weight="700"'),
    text(W / 2, bottom + 54, 30, t.text, escapeXml(result), 'text-anchor="middle" font-weight="700"'),
  ]);
};
