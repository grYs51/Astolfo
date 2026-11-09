import { avatarSvg } from './avatars';
import { escapeXml, truncate } from './render';
import { svgCard, text, W } from './svg';
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

const TOP = 40;
const AVATAR = 64;
const ICON = 168;
const ICON_Y = TOP + 116;
const ICON_MID = ICON_Y + ICON / 2;
const BOTTOM = ICON_Y + ICON + 80;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const VERBS: Record<string, string> = { rock: 'crushes', paper: 'covers', scissors: 'cut' };

/** Each move drawn in a 100×100 box: `fill` for the shape, `cut` for the lines drawn on it */
const ICONS: Record<string, (fill: string, cut: string) => string> = {
  rock: (fill, cut) =>
    `<path d="M12 68 L20 38 L42 20 L70 22 L88 44 L84 72 L60 86 L28 84 Z" fill="${fill}" stroke="${fill}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M42 20 L50 46 L20 38 M50 46 L88 44 M50 46 L60 86 M50 46 L28 84" stroke="${cut}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  paper: (fill, cut) =>
    `<path d="M26 12 H62 L78 28 V88 H26 Z" fill="${fill}"/>` +
    `<path d="M62 12 V28 H78" stroke="${cut}" stroke-width="4" fill="none" stroke-linejoin="round"/>` +
    `<path d="M36 44 H68 M36 56 H68 M36 68 H58" stroke="${cut}" stroke-width="4" stroke-linecap="round"/>`,
  scissors: (fill, cut) =>
    `<path d="M41 62 L72 12 M59 62 L28 12" stroke="${fill}" stroke-width="9" stroke-linecap="round"/>` +
    `<circle cx="34" cy="76" r="12" stroke="${fill}" stroke-width="7" fill="none"/>` +
    `<circle cx="66" cy="76" r="12" stroke="${fill}" stroke-width="7" fill="none"/>` +
    `<circle cx="50" cy="44" r="4" fill="${cut}"/>`,
};

/** One side of the face-off: avatar and name on top, the move big under them; the right side is mirrored */
const player = (p: RpsPlayer, i: 0 | 1, d: RpsCardData, t: CardTheme) => {
  const won = d.winner === i;
  const lost = d.winner === 1 - i;
  const cx = i === 0 ? W * 0.27 : W * 0.73;
  const s = ICON / 100;
  const transform = i === 0 ? `translate(${cx - ICON / 2} ${ICON_Y}) scale(${s})` : `translate(${cx + ICON / 2} ${ICON_Y}) scale(${-s} ${s})`;
  const icon = ICONS[p.move]?.(t.text, won ? t.accent : t.surface) ?? '';
  return [
    avatarSvg({ id: `p${i}`, x: cx - AVATAR / 2, y: TOP, size: AVATAR, name: p.name, image: p.avatar, theme: t }),
    won ? `<circle cx="${cx}" cy="${TOP + AVATAR / 2}" r="${AVATAR / 2 + 3}" fill="none" stroke="${t.accent}" stroke-width="3"/>` : '',
    text(cx, TOP + 88, 18, t.text, escapeXml(truncate(p.name, 26)), 'text-anchor="middle" font-weight="700"'),
    `<circle cx="${cx}" cy="${ICON_MID}" r="${ICON / 2 + 12}" fill="${won ? t.accent : t.surface}"${lost ? ' opacity="0.5"' : ''}/>`,
    `<g transform="${transform}"${lost ? ' opacity="0.35"' : ''}>${icon}</g>`,
    text(cx, ICON_Y + ICON + 52, 22, won ? t.accent : t.muted, escapeXml(capitalise(p.move)), 'text-anchor="middle" font-weight="700"'),
  ].join('');
};

/** Why the winner won, e.g. "Paper covers Rock" */
const rule = (d: RpsCardData) => {
  if (d.winner === undefined) return `Both picked ${capitalise(d.players[0].move)}`;
  const winning = d.players[d.winner].move;
  const losing = d.players[1 - d.winner].move;
  return `${capitalise(winning)} ${VERBS[winning] ?? 'beats'} ${capitalise(losing)}`;
};

/** The rock-paper-scissors result: both moves facing off, the loser faded, and who won */
export const rpsCard = (d: RpsCardData, t: CardTheme) => {
  const result = d.winner === undefined ? 'It’s a tie!' : `${truncate(d.players[d.winner].name, 32)} wins!`;
  // Points at the losing side
  const sign = d.winner === undefined ? '=' : d.winner === 0 ? '›' : '‹';
  return svgCard(BOTTOM + 96, t, [
    player(d.players[0], 0, d, t),
    player(d.players[1], 1, d, t),
    text(W / 2, ICON_MID, 64, t.muted, sign, 'dy="0.35em" text-anchor="middle" font-weight="700"'),
    text(W / 2, BOTTOM + 36, 30, t.text, escapeXml(result), 'text-anchor="middle" font-weight="700"'),
    text(W / 2, BOTTOM + 66, 16, t.muted, escapeXml(rule(d)), 'text-anchor="middle"'),
  ]);
};
